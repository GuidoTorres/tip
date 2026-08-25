import type { MercadoPagoCountry, MercadoPagoCurrency } from "./mercadopago-regions";
import type { Currency, TipStatus } from "./types";

export type CreatePaymentInput = {
  tipId: string;
  amountMinor: number;
  platformFeeMinor: number;
  currency: Currency;
  providerAccountId: string | null;
  idempotencyKey: string;
  providerAccessToken?: string;
  providerCountry?: string;
  paymentMethodData?: MercadoPagoCardPaymentData;
  returnUrl?: string;
};

export type MercadoPagoCardPaymentData = {
  token: string;
  paymentMethodId: string;
  issuerId?: string | null;
  installments: number;
  payer: { email: string; identification?: { type: string; number: string } };
};

export type CheckoutPresentation =
  | { kind: "redirect"; url: string }
  | { kind: "embedded"; clientId: string; merchantId?: string; clientToken: string; partnerAttributionId?: string }
  | { kind: "mercadopago"; publicKey: string; country: MercadoPagoCountry; currency: MercadoPagoCurrency };

export type EmbeddedCheckout = Extract<CheckoutPresentation, { kind: "embedded" }>;
export type PrepareCheckoutInput = { providerAccountId: string | null };

export type PaymentResult = {
  providerPaymentId: string;
  status: Extract<TipStatus, "pending" | "confirmed" | "rejected">;
  checkout?: CheckoutPresentation;
  gatewayFeeMinor: number | null;
};

export type PaymentWebhookEvent = {
  kind: "payment";
  eventId: string;
  providerPaymentId: string;
  providerCaptureId: string | null;
  status: "pending" | "confirmed" | "rejected" | "refunded" | "chargeback" | "ignored";
  gatewayFeeMinor: number | null;
  occurredAt: string;
};

export type CreatePayoutInput = {
  payoutId: string;
  amountMinor: number;
  recipientAmountMinor: number;
  estimatedFeeMinor: number;
  currency: Currency;
  providerAccountId: string;
  recipientType: "EMAIL" | "PAYPAL_ID";
  idempotencyKey: string;
};

export type PayoutStatus = "requested" | "processing" | "completed" | "failed";

export type PayoutResult = { providerBatchId: string; status: "processing" };

export type PayoutWebhookEvent = {
  kind: "payout";
  eventId: string;
  payoutId: string;
  providerPayoutItemId: string;
  status: "processing" | "completed" | "failed" | "unclaimed";
  actualFeeMinor: number;
  providerStatus: string;
  failureCode: string | null;
  occurredAt: string;
};

export type ProviderWebhookEvent = PaymentWebhookEvent | PayoutWebhookEvent;

export type WebhookVerificationInput = { rawBody: string; headers: Headers };

export type CapturePaymentInput = {
  providerPaymentId: string;
  providerAccountId: string | null;
  idempotencyKey: string;
};

export type CapturePaymentResult = {
  status: "pending" | "captured" | "rejected";
  providerCaptureId: string | null;
};

export interface PaymentProvider {
  readonly name: string;
  prepareCheckout?(input: PrepareCheckoutInput): Promise<EmbeddedCheckout | null>;
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  getPaymentStatus(providerPaymentId: string): Promise<PaymentResult["status"]>;
  capturePayment(input: CapturePaymentInput): Promise<CapturePaymentResult>;
  verifyWebhook(input: WebhookVerificationInput): Promise<boolean>;
  parseWebhook(rawBody: string): Promise<ProviderWebhookEvent>;
  // Solo los proveedores con custodia pagan al creador desde un saldo de TipMe.
  // Con split (Mercado Pago, dLocal Go, Whop) el dinero ya llegó a su destino.
  createPayout?(input: CreatePayoutInput): Promise<PayoutResult>;
  getPayoutStatus?(providerPayoutId: string): Promise<PayoutStatus>;
}
