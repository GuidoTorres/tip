import { z } from "zod";
import type {
  CapturePaymentInput, CapturePaymentResult, CreatePaymentInput, PaymentProvider,
  PaymentResult, PaymentWebhookEvent, PayoutResult, PayoutStatus, WebhookVerificationInput,
} from "./provider";
import { PayPalClient, type PayPalConfig } from "./paypal-client";

const webhookSchema = z.object({
  id: z.string().min(1),
  event_type: z.string().min(1),
  create_time: z.string().datetime(),
  resource: z.object({
    id: z.string().optional(),
    supplementary_data: z.object({ related_ids: z.object({ order_id: z.string().optional(), capture_id: z.string().optional() }).optional() }).optional(),
    seller_receivable_breakdown: z.object({ paypal_fee: z.object({ currency_code: z.string(), value: z.string() }).optional() }).optional(),
  }).passthrough(),
});

function usdToMinor(amount?: { currency_code: string; value: string }) {
  if (!amount || amount.currency_code !== "USD" || !/^\d+(?:\.\d{1,2})?$/.test(amount.value)) return null;
  const [whole, fraction = ""] = amount.value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}

function captureFromOrder(value: Record<string, unknown>): { id: string | null; status: string } {
  const units = Array.isArray(value.purchase_units) ? value.purchase_units : [];
  const first = units[0] as { payments?: { captures?: Array<{ id?: string; status?: string }> } } | undefined;
  const capture = first?.payments?.captures?.[0];
  return { id: capture?.id ?? null, status: capture?.status ?? String(value.status ?? "PENDING") };
}

export class PayPalPaymentProvider implements PaymentProvider {
  readonly name = "paypal";

  constructor(private readonly client: PayPalClient, private readonly config: PayPalConfig) {}

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const merchantId = this.config.singleMerchantSandbox ? this.config.partnerMerchantId : input.providerAccountId;
    if (!merchantId) throw new Error("paypal_account_not_connected");
    const [order, clientToken] = await Promise.all([
      this.client.createOrder({
        tipId: input.tipId, amountMinor: input.amountMinor, platformFeeMinor: input.platformFeeMinor,
        merchantId, idempotencyKey: input.idempotencyKey,
      }),
      this.client.generateClientToken(),
    ]);
    return {
      providerPaymentId: order.id,
      status: "pending",
      checkout: {
        kind: "embedded", clientId: this.config.clientId, merchantId,
        clientToken, ...(!this.config.singleMerchantSandbox && this.config.partnerAttributionId ? { partnerAttributionId: this.config.partnerAttributionId } : {}),
      },
      gatewayFeeMinor: null,
    };
  }

  async getPaymentStatus(): Promise<PaymentResult["status"]> { return "pending"; }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentResult> {
    const response = await this.client.captureOrder(input.providerPaymentId, input.providerAccountId, input.idempotencyKey);
    const capture = captureFromOrder(response);
    const status = capture.status === "COMPLETED" ? "captured" : capture.status === "DECLINED" || capture.status === "DENIED" ? "rejected" : "pending";
    return { status, providerCaptureId: capture.id };
  }

  verifyWebhook(input: WebhookVerificationInput) { return this.client.verifyWebhook(input.rawBody, input.headers); }

  async parseWebhook(rawBody: string): Promise<PaymentWebhookEvent> {
    const value = webhookSchema.parse(JSON.parse(rawBody));
    const related = value.resource.supplementary_data?.related_ids;
    const captureEvent = value.event_type.startsWith("PAYMENT.CAPTURE.");
    const status: PaymentWebhookEvent["status"] = ({
      "PAYMENT.CAPTURE.PENDING": "pending",
      "PAYMENT.CAPTURE.COMPLETED": "confirmed",
      "PAYMENT.CAPTURE.DECLINED": "rejected",
      "PAYMENT.CAPTURE.DENIED": "rejected",
      "PAYMENT.CAPTURE.REFUNDED": "refunded",
      "PAYMENT.CAPTURE.REVERSED": "chargeback",
    } as Record<string, PaymentWebhookEvent["status"]>)[value.event_type] ?? "ignored";
    const captureId = captureEvent ? value.resource.id ?? null : related?.capture_id ?? null;
    const paymentId = related?.order_id ?? captureId;
    if (!paymentId) throw new Error("paypal_event_not_correlatable");
    return {
      eventId: value.id,
      providerPaymentId: paymentId,
      providerCaptureId: captureId,
      status,
      gatewayFeeMinor: usdToMinor(value.resource.seller_receivable_breakdown?.paypal_fee),
      occurredAt: value.create_time,
    };
  }

  async createPayout(): Promise<PayoutResult> { throw new Error("payouts_managed_by_paypal"); }
  async getPayoutStatus(): Promise<PayoutStatus> { throw new Error("payouts_managed_by_paypal"); }
}
