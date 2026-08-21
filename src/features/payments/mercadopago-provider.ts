import type {
  CapturePaymentResult, CreatePaymentInput,
  PaymentProvider, PaymentResult, PayoutResult, PayoutStatus, ProviderWebhookEvent,
} from "./provider";
import { currencyFractionDigits } from "./mercadopago-exchange-rate";

type MercadoPagoErrorResponse = {
  error?: unknown;
  message?: unknown;
  cause?: Array<{ code?: unknown; description?: unknown }>;
};

function safeProviderText(value: unknown) {
  return typeof value === "string" ? value.slice(0, 240) : undefined;
}

export class MercadoPagoPaymentProvider implements PaymentProvider {
  readonly name = "mercadopago";
  private readonly fetchImpl: typeof fetch;
  private readonly appUrl: string;

  constructor(config: { appUrl: string; fetchImpl?: typeof fetch }) {
    // Vercel values are sometimes pasted with quotes or whitespace. Normalize
    // them before building the externally reachable webhook URL.
    this.appUrl = config.appUrl.trim().replace(/^['"]|['"]$/g, "").replace(/\/$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    if (!input.providerAccountId || !input.providerAccessToken || !input.providerCountry) throw new Error("mercadopago_credentials_missing");
    if (!input.paymentMethodData) throw new Error("mercadopago_payment_data_missing");
    if (!["ARS", "BRL", "CLP", "COP", "MXN", "PEN", "UYU"].includes(input.currency)) throw new Error("unsupported_currency");
    const card = input.paymentMethodData;
    const unit = 10 ** currencyFractionDigits(input.currency);
    const notificationUrl = `${this.appUrl}/api/webhooks/mercadopago/${input.providerCountry}`;
    const body = {
      transaction_amount: input.amountMinor / unit,
      application_fee: input.platformFeeMinor / unit,
      token: card.token,
      installments: card.installments,
      payment_method_id: card.paymentMethodId,
      ...(card.issuerId ? { issuer_id: card.issuerId } : {}),
      payer: {
        email: card.payer.email,
        ...(card.payer.identification ? { identification: card.payer.identification } : {}),
      },
      description: "Tip mediante TipMe",
      external_reference: input.tipId,
      notification_url: notificationUrl,
      metadata: { tip_id: input.tipId, tipme_creator_id: input.providerAccountId },
    };
    console.info(JSON.stringify({
      event: "mercadopago_payment_request",
      appUrl: this.appUrl,
      providerCountry: input.providerCountry,
      notificationUrl,
    }));
    const response = await this.fetchImpl("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.providerAccessToken}`,
        "content-type": "application/json",
        "x-idempotency-key": input.idempotencyKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const result = await response.json().catch(() => null) as ({ id?: string | number } & MercadoPagoErrorResponse) | null;
    if (!response.ok || result?.id === undefined) {
      const cause = Array.isArray(result?.cause) ? result.cause[0] : undefined;
      console.error(JSON.stringify({
        event: "mercadopago_payment_create_failed",
        status: response.status,
        ...(safeProviderText(result?.error) ? { error: safeProviderText(result?.error) } : {}),
        ...(safeProviderText(result?.message) ? { message: safeProviderText(result?.message) } : {}),
        ...(cause?.code !== undefined ? { causeCode: String(cause.code).slice(0, 80) } : {}),
        ...(safeProviderText(cause?.description) ? { causeDescription: safeProviderText(cause?.description) } : {}),
        notificationUrl,
      }));
      throw new Error("mercadopago_payment_create_failed");
    }
    return { providerPaymentId: String(result.id), status: "pending", gatewayFeeMinor: null };
  }

  async getPaymentStatus(): Promise<PaymentResult["status"]> { return "pending"; }
  async capturePayment(): Promise<CapturePaymentResult> { return { status: "pending", providerCaptureId: null }; }
  async verifyWebhook(): Promise<boolean> { throw new Error("mercadopago_webhook_uses_regional_handler"); }
  async parseWebhook(): Promise<ProviderWebhookEvent> { throw new Error("mercadopago_webhook_uses_regional_handler"); }
  async createPayout(): Promise<PayoutResult> { throw new Error("payouts_managed_by_mercadopago"); }
  async getPayoutStatus(): Promise<PayoutStatus> { throw new Error("payouts_managed_by_mercadopago"); }
}
