import { Webhook } from "standardwebhooks";
import { describe, expect, it, vi } from "vitest";
import { WhopPaymentProvider } from "@/features/payments/whop-provider";

const webhookSecret = "ws_test_secret_1234567890";

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay_1",
    status: "paid",
    substatus: "succeeded",
    currency: "usd",
    subtotal: 20,
    total: 20,
    amount_after_fees: 18.9,
    company: { id: "biz_creator", title: "Creator", route: "creator" },
    metadata: { tip_id: "tip-1" },
    checkout_configuration_id: "ch_1",
    created_at: "2026-08-25T12:00:00.000Z",
    updated_at: "2026-08-25T12:00:01.000Z",
    paid_at: "2026-08-25T12:00:01.000Z",
    refunded_at: null,
    refunded_amount: 0,
    disputes: [],
    ...overrides,
  };
}

function api() {
  return {
    checkoutConfigurations: { create: vi.fn().mockResolvedValue({ id: "ch_1", purchase_url: "https://whop.com/checkout/ch_1" }) },
    payments: { retrieve: vi.fn().mockResolvedValue(payment()) },
    companies: { retrieve: vi.fn().mockResolvedValue({ id: "biz_creator", title: "Creator", verified: true }) },
  };
}

function signedHeaders(rawBody: string) {
  const id = "msg_1";
  const timestamp = new Date();
  const signer = new Webhook(webhookSecret, { format: "raw" });
  return new Headers({
    "webhook-id": id,
    "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "webhook-signature": signer.sign(id, timestamp, rawBody),
  });
}

describe("WhopPaymentProvider", () => {
  it("creates a one-time USD checkout for the creator company with no platform fee", async () => {
    const client = api();
    const provider = new WhopPaymentProvider({ apiKey: "app_key", webhookSecret, appUrl: "https://tipme.pro", client });

    const result = await provider.createPayment({
      tipId: "tip-1", amountMinor: 2_000, platformFeeMinor: 0, currency: "USD",
      providerAccountId: "biz_creator", idempotencyKey: "create:tip-1",
    });

    expect(client.checkoutConfigurations.create).toHaveBeenCalledWith(expect.objectContaining({
      account_id: "biz_creator",
      mode: "payment",
      metadata: { tip_id: "tip-1" },
      plan: expect.objectContaining({ account_id: "biz_creator", initial_price: 20, currency: "usd", plan_type: "one_time" }),
    }), expect.objectContaining({ idempotencyKey: "create:tip-1" }));
    expect(client.checkoutConfigurations.create.mock.calls[0][0].plan).not.toHaveProperty("application_fee_amount");
    expect(result).toEqual({
      providerPaymentId: "ch_1", status: "pending",
      checkout: { kind: "redirect", url: "https://whop.com/checkout/ch_1" }, gatewayFeeMinor: null,
    });
  });

  it("fails closed without a connected creator company", async () => {
    const provider = new WhopPaymentProvider({ apiKey: "app_key", webhookSecret, appUrl: "https://tipme.pro", client: api() });
    await expect(provider.createPayment({
      tipId: "tip-1", amountMinor: 2_000, platformFeeMinor: 0, currency: "USD",
      providerAccountId: null, idempotencyKey: "create:tip-1",
    })).rejects.toThrow("whop_account_not_connected");
  });

  it("rejects platform fees during the zero-fee pilot", async () => {
    const provider = new WhopPaymentProvider({ apiKey: "app_key", webhookSecret, appUrl: "https://tipme.pro", client: api() });
    await expect(provider.createPayment({
      tipId: "tip-1", amountMinor: 2_000, platformFeeMinor: 20, currency: "USD",
      providerAccountId: "biz_creator", idempotencyKey: "create:tip-1",
    })).rejects.toThrow("whop_platform_fee_not_supported");
  });

  it("verifies Standard Webhooks and rejects a tampered body", async () => {
    const provider = new WhopPaymentProvider({ apiKey: "app_key", webhookSecret, appUrl: "https://tipme.pro", client: api() });
    const rawBody = JSON.stringify({ id: "msg_1", type: "payment.succeeded", data: { id: "pay_1" } });
    const headers = signedHeaders(rawBody);

    await expect(provider.verifyWebhook({ rawBody, headers })).resolves.toBe(true);
    await expect(provider.verifyWebhook({ rawBody: `${rawBody} `, headers })).resolves.toBe(false);
  });

  it("reads the authoritative payment and maps a successful event", async () => {
    const client = api();
    const provider = new WhopPaymentProvider({ apiKey: "app_key", webhookSecret, appUrl: "https://tipme.pro", client });
    const rawBody = JSON.stringify({
      id: "msg_1", type: "payment.succeeded", timestamp: "2026-08-25T12:00:02.000Z",
      account_id: "biz_creator", data: { id: "pay_1" },
    });

    const event = await provider.parseWebhook(rawBody);

    expect(client.payments.retrieve).toHaveBeenCalledWith({ id: "pay_1" });
    expect(event).toEqual({
      kind: "payment", eventId: "msg_1", providerPaymentId: "ch_1", providerCaptureId: "pay_1",
      status: "confirmed", gatewayFeeMinor: 110, occurredAt: "2026-08-25T12:00:02.000Z",
    });
  });

  it("ignores a payment whose company or metadata does not match the checkout", async () => {
    const client = api();
    client.payments.retrieve.mockResolvedValue(payment({ company: { id: "biz_other" }, metadata: {} }));
    const provider = new WhopPaymentProvider({ apiKey: "app_key", webhookSecret, appUrl: "https://tipme.pro", client });

    const event = await provider.parseWebhook(JSON.stringify({
      id: "msg_2", type: "payment.succeeded", timestamp: "2026-08-25T12:00:02.000Z",
      account_id: "biz_creator", data: { id: "pay_1" },
    }));

    expect(event.status).toBe("ignored");
  });

  it("never turns an untrusted failed event into a rejection", async () => {
    const client = api();
    client.payments.retrieve.mockResolvedValue(payment({ company: { id: "biz_other" }, status: "void" }));
    const provider = new WhopPaymentProvider({ apiKey: "app_key", webhookSecret, appUrl: "https://tipme.pro", client });

    const event = await provider.parseWebhook(JSON.stringify({
      id: "msg_3", type: "payment.failed", timestamp: "2026-08-25T12:00:02.000Z",
      account_id: "biz_creator", data: { id: "pay_1" },
    }));

    expect(event.status).toBe("ignored");
  });
});
