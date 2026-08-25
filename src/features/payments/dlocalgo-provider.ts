import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CapturePaymentResult, CreatePaymentInput,
  PaymentProvider, PaymentResult, ProviderWebhookEvent, WebhookVerificationInput,
} from "./provider";

// dLocal Go trabaja en unidades mayores con dos decimales; el dominio siempre en minor units.
const DECIMALS = 2;

// La notificación solo trae el id: el estado se lee del recurso autoritativo.
type DLocalGoNotification = { payment_id?: unknown };

type DLocalGoPayment = {
  id?: string | number;
  status?: unknown;
  status_code?: unknown;
  currency?: unknown;
  amount?: unknown;
  order_id?: unknown;
  created_date?: unknown;
  redirect_url?: unknown;
};

// https://docs.dlocalgo.com — estados del recurso Payment.
const STATUS_MAP: Record<string, PaymentWebhookStatus> = {
  PAID: "confirmed",
  AUTHORIZED: "pending",
  PENDING: "pending",
  VERIFIED: "pending",
  REJECTED: "rejected",
  CANCELLED: "rejected",
  EXPIRED: "rejected",
  REFUNDED: "refunded",
  CHARGEBACK: "chargeback",
};

type PaymentWebhookStatus = Extract<ProviderWebhookEvent, { kind: "payment" }>["status"];

function safeText(value: unknown) {
  return typeof value === "string" ? value.slice(0, 240) : undefined;
}

export class DLocalGoPaymentProvider implements PaymentProvider {
  readonly name = "dlocalgo";
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly appUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: {
    apiKey: string;
    secretKey: string;
    environment: "sandbox" | "live";
    appUrl: string;
    fetchImpl?: typeof fetch;
  }) {
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.baseUrl = config.environment === "live" ? "https://api.dlocalgo.com" : "https://api-sbx.dlocalgo.com";
    // Vercel a veces pega el valor con comillas o espacios.
    this.appUrl = config.appUrl.trim().replace(/^['"]|['"]$/g, "").replace(/\/$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private authorization() {
    return `Bearer ${this.apiKey}:${this.secretKey}`;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    // El reparto exige el split_code del contrato con la creadora.
    if (!input.providerAccountId) throw new Error("dlocalgo_split_code_missing");
    const unit = 10 ** DECIMALS;
    const webhookUrl = this.appUrl.startsWith("https://") ? `${this.appUrl}/api/webhooks/dlocalgo` : null;

    const body = {
      amount: input.amountMinor / unit,
      currency: input.currency,
      order_id: input.tipId,
      description: "Tip mediante TipMe",
      split_code: input.providerAccountId,
      ...(input.providerCountry ? { country: input.providerCountry } : {}),
      ...(webhookUrl ? { notification_url: webhookUrl } : {}),
      ...(this.appUrl ? { success_url: `${this.appUrl}/tips/${input.tipId}/receipt`, back_url: this.appUrl } : {}),
    };

    const response = await this.fetchImpl(`${this.baseUrl}/v1/payments`, {
      method: "POST",
      headers: {
        authorization: this.authorization(),
        "content-type": "application/json",
        "x-idempotency-key": input.idempotencyKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const result = await response.json().catch(() => null) as (DLocalGoPayment & { message?: unknown; code?: unknown }) | null;
    if (!response.ok || result?.id === undefined) {
      console.error(JSON.stringify({
        event: "dlocalgo_payment_create_failed",
        status: response.status,
        ...(safeText(result?.code) ? { code: safeText(result?.code) } : {}),
        ...(safeText(result?.message) ? { message: safeText(result?.message) } : {}),
        webhookMode: webhookUrl ? "notification_url" : "dashboard_configured",
      }));
      throw new Error("dlocalgo_payment_create_failed");
    }

    const redirect = typeof result.redirect_url === "string" ? result.redirect_url : null;
    if (!redirect) throw new Error("dlocalgo_redirect_missing");

    return {
      providerPaymentId: String(result.id),
      status: "pending",
      checkout: { kind: "redirect", url: redirect },
      gatewayFeeMinor: null,
    };
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentResult["status"]> {
    const payment = await this.retrievePayment(providerPaymentId);
    const mapped = STATUS_MAP[String(payment.status ?? "").toUpperCase()];
    return mapped === "confirmed" ? "confirmed" : mapped === "rejected" ? "rejected" : "pending";
  }

  // dLocal Go no separa autorización de captura en este flujo.
  async capturePayment(): Promise<CapturePaymentResult> {
    return { status: "pending", providerCaptureId: null };
  }

  // HMAC-SHA256 sobre apiKey + cuerpo crudo, con la clave secreta.
  async verifyWebhook({ rawBody, headers }: WebhookVerificationInput): Promise<boolean> {
    const header = headers.get("authorization") ?? "";
    const received = /Signature:\s*([A-Za-z0-9+/=]+)/i.exec(header)?.[1];
    if (!received) return false;
    const expected = createHmac("sha256", this.secretKey).update(`${this.apiKey}${rawBody}`).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(received);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async parseWebhook(rawBody: string): Promise<ProviderWebhookEvent> {
    const notification = JSON.parse(rawBody) as DLocalGoNotification;
    const paymentId = typeof notification.payment_id === "string" || typeof notification.payment_id === "number"
      ? String(notification.payment_id)
      : "";
    if (!paymentId) throw new Error("dlocalgo_notification_invalid");

    // La notificación no trae estado: se consulta el recurso autoritativo.
    const payment = await this.retrievePayment(paymentId);
    const rawStatus = String(payment.status ?? "").toUpperCase();
    const status = STATUS_MAP[rawStatus] ?? "ignored";
    const occurredAt = typeof payment.created_date === "string" ? payment.created_date : new Date().toISOString();

    return {
      kind: "payment",
      eventId: `dlocalgo:${paymentId}:${rawStatus}:${occurredAt}`,
      providerPaymentId: paymentId,
      providerCaptureId: null,
      status,
      gatewayFeeMinor: null,
      occurredAt,
    };
  }

  private async retrievePayment(paymentId: string): Promise<DLocalGoPayment> {
    const response = await this.fetchImpl(`${this.baseUrl}/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { authorization: this.authorization() },
      cache: "no-store",
    });
    const payment = await response.json().catch(() => null) as DLocalGoPayment | null;
    if (!response.ok || !payment) throw new Error("dlocalgo_payment_lookup_failed");
    return payment;
  }
}
