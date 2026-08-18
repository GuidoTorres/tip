import { createHash } from "node:crypto";
import { z } from "zod";
import { verifyMockWebhook } from "@/lib/security/hmac";
import type {
  CreatePaymentInput, CreatePayoutInput, PaymentProvider, PaymentResult,
  PaymentWebhookEvent, PayoutResult, PayoutStatus,
} from "./provider";

const eventSchema = z.object({
  eventId: z.string().min(1),
  providerPaymentId: z.string().min(1),
  status: z.enum(["pending", "confirmed", "rejected", "refunded", "chargeback"]),
  gatewayFeeMinor: z.number().int().min(0).nullable().default(null),
  occurredAt: z.string().datetime(),
});

function stableId(prefix: string, idempotencyKey: string): string {
  return `${prefix}${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 24)}`;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  constructor(private readonly webhookSecret: string) {}

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const providerPaymentId = stableId("mock_pay_", input.idempotencyKey);
    return {
      providerPaymentId,
      status: "pending",
      checkout: { kind: "redirect", url: `/pay/mock/${providerPaymentId}` },
      gatewayFeeMinor: null,
    };
  }

  async getPaymentStatus(): Promise<PaymentResult["status"]> {
    return "pending";
  }

  async capturePayment(): Promise<{ status: "pending"; providerCaptureId: null }> {
    return { status: "pending", providerCaptureId: null };
  }

  async verifyWebhook(input: { rawBody: string; headers: Headers }): Promise<boolean> {
    return verifyMockWebhook(input.rawBody, input.headers.get("x-tipme-signature") ?? "", this.webhookSecret);
  }

  async parseWebhook(rawBody: string): Promise<PaymentWebhookEvent> {
    return { ...eventSchema.parse(JSON.parse(rawBody)), providerCaptureId: null };
  }

  async createPayout(input: CreatePayoutInput): Promise<PayoutResult> {
    return { providerPayoutId: stableId("mock_po_", input.idempotencyKey), status: "requested" };
  }

  async getPayoutStatus(): Promise<PayoutStatus> {
    return "requested";
  }
}
