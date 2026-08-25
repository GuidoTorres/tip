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
  | { kind: "mercadopago"; publicKey: string; country: MercadoPagoCountry; currency: MercadoPagoCurrency };

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

export type ProviderWebhookEvent = PaymentWebhookEvent;

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
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  getPaymentStatus(providerPaymentId: string): Promise<PaymentResult["status"]>;
  capturePayment(input: CapturePaymentInput): Promise<CapturePaymentResult>;
  verifyWebhook(input: WebhookVerificationInput): Promise<boolean>;
  parseWebhook(rawBody: string): Promise<ProviderWebhookEvent>;
}
