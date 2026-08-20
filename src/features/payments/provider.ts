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
  recipientAmountMinor: number;
  estimatedFeeMinor: number;
  currency: Currency;
  providerAccountId: string;
  recipientType: "EMAIL" | "PAYPAL_ID";
  idempotencyKey: string;
};

export type PayoutStatus = "requested" | "processing" | "completed" | "failed";

export type PayoutResult = { providerBatchId: string; status: "processing" };

export type PaymentWebhookEvent = {
  kind: "payment";
  eventId: string;
  providerPaymentId: string;
  providerCaptureId: string | null;
  status: "pending" | "confirmed" | "rejected" | "refunded" | "chargeback" | "ignored";
  gatewayFeeMinor: number | null;
  occurredAt: string;
};

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
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  getPaymentStatus(providerPaymentId: string): Promise<PaymentResult["status"]>;
  capturePayment(input: CapturePaymentInput): Promise<CapturePaymentResult>;
  verifyWebhook(input: WebhookVerificationInput): Promise<boolean>;
  parseWebhook(rawBody: string): Promise<ProviderWebhookEvent>;
  createPayout(input: CreatePayoutInput): Promise<PayoutResult>;
  getPayoutStatus(providerPayoutId: string): Promise<PayoutStatus>;
}
