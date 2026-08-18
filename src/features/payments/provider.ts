import type { Currency, TipStatus } from "./types";

export type CreatePaymentInput = {
  tipId: string;
  amountMinor: number;
  platformFeeMinor: number;
  currency: Currency;
  providerAccountId: string | null;
  idempotencyKey: string;
};

export type CheckoutPresentation =
  | { kind: "redirect"; url: string }
  | { kind: "embedded"; clientId: string; merchantId: string; clientToken: string; partnerAttributionId?: string };

export type PaymentResult = {
  providerPaymentId: string;
  status: Extract<TipStatus, "pending" | "confirmed" | "rejected">;
  checkout: CheckoutPresentation;
  gatewayFeeMinor: number | null;
};

export type CreatePayoutInput = {
  payoutId: string;
  amountMinor: number;
  currency: Currency;
  providerAccountId: string;
  idempotencyKey: string;
};

export type PayoutStatus = "requested" | "processing" | "completed" | "failed";

export type PayoutResult = { providerPayoutId: string; status: PayoutStatus };

export type PaymentWebhookEvent = {
  eventId: string;
  providerPaymentId: string;
  providerCaptureId: string | null;
  status: "pending" | "confirmed" | "rejected" | "refunded" | "chargeback" | "ignored";
  gatewayFeeMinor: number | null;
  occurredAt: string;
};

export type WebhookVerificationInput = { rawBody: string; headers: Headers };

export type CapturePaymentInput = {
  providerPaymentId: string;
  providerAccountId: string;
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
  parseWebhook(rawBody: string): Promise<PaymentWebhookEvent>;
  createPayout(input: CreatePayoutInput): Promise<PayoutResult>;
  getPayoutStatus(providerPayoutId: string): Promise<PayoutStatus>;
}
