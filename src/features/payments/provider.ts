import type { Currency, TipStatus } from "./types";

export type CreatePaymentInput = {
  tipId: string;
  amountMinor: number;
  currency: Currency;
  idempotencyKey: string;
};

export type PaymentResult = {
  providerPaymentId: string;
  status: Extract<TipStatus, "pending" | "confirmed" | "rejected">;
  checkoutUrl: string;
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
  status: "pending" | "confirmed" | "rejected" | "refunded" | "chargeback";
  gatewayFeeMinor: number | null;
  occurredAt: string;
};

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  getPaymentStatus(providerPaymentId: string): Promise<PaymentResult["status"]>;
  verifyWebhook(rawBody: string, signature: string, nowSeconds?: number): boolean;
  parseWebhook(rawBody: string): PaymentWebhookEvent;
  createPayout(input: CreatePayoutInput): Promise<PayoutResult>;
  getPayoutStatus(providerPayoutId: string): Promise<PayoutStatus>;
}

