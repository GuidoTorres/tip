import { WhopClient } from "@whop/sdk";
import { unwrapWebhook } from "@whop/sdk/helpers";
import type {
  CapturePaymentResult,
  CreatePaymentInput,
  PaymentProvider,
  PaymentResult,
  PaymentWebhookEvent,
  WebhookVerificationInput,
} from "./provider";

type WhopCheckout = { id: string; purchase_url?: string | null };
type WhopCompany = { id: string; title: string; verified: boolean };
type WhopPayment = {
  id: string;
  status: string | null;
  substatus?: string | null;
  subtotal: number | null;
  total: number | null;
  amount_after_fees: number;
  company: { id: string } | null;
  metadata: Record<string, unknown> | null;
  checkout_configuration_id: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  refunded_at: string | null;
  refunded_amount: number | null;
  disputes: Array<{ status: string }> | null;
};

type CheckoutInput = {
  account_id: string;
  mode: "payment";
  metadata: { tip_id: string };
  redirect_url: string;
  plan: {
    account_id: string;
    initial_price: number;
    currency: "usd";
    plan_type: "one_time";
    release_method: "buy_now";
    title: string;
    description: string;
  };
};

export type WhopApi = {
  checkoutConfigurations: { create(input: CheckoutInput, options?: { idempotencyKey?: string }): Promise<WhopCheckout> };
  payments: { retrieve(input: { id: string }): Promise<WhopPayment> };
  companies: { retrieve(input: { id: string }): Promise<WhopCompany> };
};

type WhopWebhookEnvelope = {
  id?: unknown;
  type?: unknown;
  timestamp?: unknown;
  account_id?: unknown;
  company_id?: unknown;
  data?: Record<string, unknown>;
};

export function createWhopApi(apiKey: string, fetchImpl?: typeof fetch): WhopApi {
  return new WhopClient({ token: apiKey, ...(fetchImpl ? { fetch: fetchImpl } : {}) }) as unknown as WhopApi;
}

function dollarsToMinor(amount: number | null | undefined) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function paymentStatus(payment: WhopPayment): PaymentWebhookEvent["status"] {
  if (payment.refunded_at || Number(payment.refunded_amount ?? 0) > 0) return "refunded";
  if (payment.disputes?.some((dispute) => !["won", "closed", "warning_closed"].includes(dispute.status))) return "chargeback";
  if (payment.status === "paid") return "confirmed";
  if (["void", "uncollectible"].includes(payment.status ?? "")) return "rejected";
  if (["draft", "open", "pending", "unresolved"].includes(payment.status ?? "")) return "pending";
  return "ignored";
}

function nestedPaymentId(data: Record<string, unknown> | undefined) {
  if (typeof data?.id === "string" && data.id.startsWith("pay_")) return data.id;
  const payment = data?.payment;
  if (payment && typeof payment === "object" && typeof (payment as { id?: unknown }).id === "string") {
    return (payment as { id: string }).id;
  }
  return null;
}

export class WhopPaymentProvider implements PaymentProvider {
  readonly name = "whop";
  private readonly client: WhopApi;

  constructor(private readonly config: {
    apiKey: string;
    webhookSecret: string;
    appUrl: string;
    client?: WhopApi;
    fetchImpl?: typeof fetch;
  }) {
    this.client = config.client ?? createWhopApi(config.apiKey, config.fetchImpl);
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    if (!input.providerAccountId?.startsWith("biz_")) throw new Error("whop_account_not_connected");
    if (input.currency !== "USD") throw new Error("whop_currency_not_supported");
    if (input.platformFeeMinor !== 0) throw new Error("whop_platform_fee_not_supported");

    const checkout = await this.client.checkoutConfigurations.create({
      account_id: input.providerAccountId,
      mode: "payment",
      metadata: { tip_id: input.tipId },
      redirect_url: input.returnUrl ?? this.config.appUrl,
      plan: {
        account_id: input.providerAccountId,
        initial_price: input.amountMinor / 100,
        currency: "usd",
        plan_type: "one_time",
        release_method: "buy_now",
        title: "Tip en TipMe",
        description: "Aporte voluntario",
      },
    }, { idempotencyKey: input.idempotencyKey });

    if (!checkout.id?.startsWith("ch_") || !checkout.purchase_url) throw new Error("whop_checkout_invalid");
    const url = new URL(checkout.purchase_url, "https://whop.com");
    if (url.protocol !== "https:" || !/(^|\.)whop\.com$/i.test(url.hostname)) throw new Error("whop_checkout_invalid");

    return {
      providerPaymentId: checkout.id,
      status: "pending",
      checkout: { kind: "redirect", url: url.toString() },
      gatewayFeeMinor: null,
    };
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentResult["status"]> {
    if (!providerPaymentId.startsWith("pay_")) return "pending";
    const payment = await this.client.payments.retrieve({ id: providerPaymentId });
    const status = paymentStatus(payment);
    return status === "confirmed" || status === "rejected" ? status : "pending";
  }

  async capturePayment(): Promise<CapturePaymentResult> {
    return { status: "pending", providerCaptureId: null };
  }

  async verifyWebhook({ rawBody, headers }: WebhookVerificationInput): Promise<boolean> {
    try {
      unwrapWebhook(rawBody, { headers: Object.fromEntries(headers), key: this.config.webhookSecret });
      return true;
    } catch {
      return false;
    }
  }

  async parseWebhook(rawBody: string): Promise<PaymentWebhookEvent> {
    const envelope = JSON.parse(rawBody) as WhopWebhookEnvelope;
    const eventId = typeof envelope.id === "string" ? envelope.id : null;
    const eventType = typeof envelope.type === "string" ? envelope.type : "";
    const occurredAt = typeof envelope.timestamp === "string" ? envelope.timestamp : new Date().toISOString();
    const accountId = typeof envelope.account_id === "string" ? envelope.account_id
      : typeof envelope.company_id === "string" ? envelope.company_id : null;
    const paymentId = nestedPaymentId(envelope.data);
    if (!eventId || !paymentId || !eventType) throw new Error("whop_webhook_invalid");

    const payment = await this.client.payments.retrieve({ id: paymentId });
    const tipId = payment.metadata?.tip_id;
    const checkoutId = payment.checkout_configuration_id;
    const companyMatches = Boolean(accountId && payment.company?.id === accountId);
    const belongsToTipMe = typeof tipId === "string" && tipId.length > 0 && Boolean(checkoutId?.startsWith("ch_"));
    const trusted = companyMatches && belongsToTipMe;
    let status = trusted ? paymentStatus(payment) : "ignored";

    if (trusted) {
      if (eventType === "payment.failed" && status !== "confirmed") status = "rejected";
      if (eventType.startsWith("refund.") && status !== "refunded") status = "pending";
      if (eventType.startsWith("dispute.") && status !== "chargeback") status = "ignored";
      if (!eventType.startsWith("payment.") && !eventType.startsWith("refund.") && !eventType.startsWith("dispute.")) status = "ignored";
    }

    const grossMinor = dollarsToMinor(payment.subtotal ?? payment.total);
    const netMinor = dollarsToMinor(payment.amount_after_fees);
    const gatewayFeeMinor = status === "confirmed" && grossMinor !== null && netMinor !== null
      ? Math.max(0, grossMinor - netMinor)
      : null;

    return {
      kind: "payment",
      eventId,
      providerPaymentId: checkoutId ?? payment.id,
      providerCaptureId: checkoutId ? payment.id : null,
      status,
      gatewayFeeMinor,
      occurredAt,
    };
  }
}
