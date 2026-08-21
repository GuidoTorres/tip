import type {
  CapturePaymentResult, CreatePaymentInput,
  PaymentProvider, PaymentResult, PayoutResult, PayoutStatus, ProviderWebhookEvent,
} from "./provider";

export class MercadoPagoPaymentProvider implements PaymentProvider {
  readonly name = "mercadopago";
  private readonly fetchImpl: typeof fetch;
  private readonly appUrl: string;

  constructor(config: { appUrl: string; fetchImpl?: typeof fetch }) {
    this.appUrl = config.appUrl.replace(/\/$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    if (!input.providerAccountId || !input.providerAccessToken || !input.providerCountry) throw new Error("mercadopago_credentials_missing");
    if (!input.paymentMethodData) throw new Error("mercadopago_payment_data_missing");
    if (!["ARS", "BRL", "CLP", "COP", "MXN", "PEN", "UYU"].includes(input.currency)) throw new Error("unsupported_currency");
    const card = input.paymentMethodData;
    const body = {
      transaction_amount: input.amountMinor / 100,
      application_fee: input.platformFeeMinor / 100,
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
      notification_url: `${this.appUrl}/api/webhooks/mercadopago/${input.providerCountry}`,
      metadata: { tip_id: input.tipId, tipme_creator_id: input.providerAccountId },
    };
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
    const result = await response.json().catch(() => null) as { id?: string | number; message?: string } | null;
    if (!response.ok || result?.id === undefined) {
      console.error(JSON.stringify({ event: "mercadopago_payment_create_failed", status: response.status }));
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
