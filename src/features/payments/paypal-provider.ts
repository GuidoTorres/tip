import { z } from "zod";
import type {
  CapturePaymentInput, CapturePaymentResult, CreatePaymentInput, CreatePayoutInput, PaymentProvider,
  PaymentResult, PaymentWebhookEvent, PayoutResult, PayoutStatus, ProviderWebhookEvent, WebhookVerificationInput,
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

const payoutItemSchema = z.object({
  payout_item_id: z.string().min(1),
  transaction_status: z.string().min(1),
  payout_item_fee: z.object({ currency: z.string(), value: z.string() }).optional(),
  payout_item: z.object({ sender_item_id: z.string().uuid() }),
  errors: z.object({ name: z.string().optional() }).optional(),
}).passthrough();

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
    const merchantId = this.config.flow === "platform_payouts" || this.config.singleMerchantSandbox
      ? this.config.partnerMerchantId
      : input.providerAccountId;
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
        clientToken, ...(this.config.flow === "multiparty" && !this.config.singleMerchantSandbox && this.config.partnerAttributionId ? { partnerAttributionId: this.config.partnerAttributionId } : {}),
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

  async parseWebhook(rawBody: string): Promise<ProviderWebhookEvent> {
    const value = webhookSchema.parse(JSON.parse(rawBody));
    const payoutStatuses = {
      "PAYMENT.PAYOUTS-ITEM.SUCCEEDED": "completed",
      "PAYMENT.PAYOUTS-ITEM.FAILED": "failed",
      "PAYMENT.PAYOUTS-ITEM.BLOCKED": "failed",
      "PAYMENT.PAYOUTS-ITEM.RETURNED": "failed",
      "PAYMENT.PAYOUTS-ITEM.CANCELED": "failed",
      "PAYMENT.PAYOUTS-ITEM.REFUNDED": "failed",
      "PAYMENT.PAYOUTS-ITEM.HELD": "processing",
      "PAYMENT.PAYOUTS-ITEM.UNCLAIMED": "unclaimed",
    } as const;
    const payoutStatus = payoutStatuses[value.event_type as keyof typeof payoutStatuses];
    if (payoutStatus) {
      if (!value.resource.id) throw new Error("paypal_event_not_correlatable");
      const details = payoutItemSchema.parse(await this.client.getPayoutItem(value.resource.id));
      if (payoutStatus === "unclaimed") await this.client.cancelUnclaimedPayoutItem(details.payout_item_id);
      const actualFeeMinor = usdToMinor(details.payout_item_fee
        ? { currency_code: details.payout_item_fee.currency, value: details.payout_item_fee.value }
        : undefined);
      if (actualFeeMinor === null) throw new Error("paypal_payout_fee_unavailable");
      return {
        kind: "payout",
        eventId: value.id,
        payoutId: details.payout_item.sender_item_id,
        providerPayoutItemId: details.payout_item_id,
        status: payoutStatus,
        actualFeeMinor,
        providerStatus: details.transaction_status,
        failureCode: details.errors?.name ?? null,
        occurredAt: value.create_time,
      };
    }
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
    if (status === "ignored") {
      return {
        kind: "payment",
        eventId: value.id,
        providerPaymentId: value.resource.id ?? value.id,
        providerCaptureId: captureId,
        status,
        gatewayFeeMinor: null,
        occurredAt: value.create_time,
      };
    }
    if (!paymentId) throw new Error("paypal_event_not_correlatable");
    let gatewayFeeMinor = usdToMinor(value.resource.seller_receivable_breakdown?.paypal_fee);
    if (status === "confirmed" && this.config.flow === "platform_payouts" && gatewayFeeMinor === null) {
      if (!captureId) throw new Error("paypal_fee_unavailable");
      const capture = await this.client.getCapture(captureId);
      gatewayFeeMinor = usdToMinor(capture.seller_receivable_breakdown?.paypal_fee);
      if (gatewayFeeMinor === null) throw new Error("paypal_fee_unavailable");
    }
    return {
      kind: "payment",
      eventId: value.id,
      providerPaymentId: paymentId,
      providerCaptureId: captureId,
      status,
      gatewayFeeMinor,
      occurredAt: value.create_time,
    };
  }

  async createPayout(input: CreatePayoutInput): Promise<PayoutResult> {
    if (this.config.flow !== "platform_payouts") throw new Error("payouts_managed_by_paypal");
    if (input.currency !== "USD") throw new Error("unsupported_currency");
    const result = await this.client.createPayoutBatch({
      payoutId: input.payoutId,
      recipientAmountMinor: input.recipientAmountMinor,
      currency: input.currency,
      receiver: input.providerAccountId,
      recipientType: input.recipientType,
      idempotencyKey: input.idempotencyKey,
    });
    const providerBatchId = result.batch_header?.payout_batch_id;
    if (!providerBatchId) throw new Error("paypal_payout_batch_missing");
    return { providerBatchId, status: "processing" };
  }

  async getPayoutStatus(providerPayoutId: string): Promise<PayoutStatus> {
    if (this.config.flow !== "platform_payouts") throw new Error("payouts_managed_by_paypal");
    const result = await this.client.getPayoutBatch(providerPayoutId);
    const status = result.batch_header?.batch_status;
    if (status === "SUCCESS") return "completed";
    if (status === "DENIED" || status === "CANCELED") return "failed";
    return "processing";
  }
}
