import { describe, expect, it, vi } from "vitest";
import { PayPalClient, createPayPalAuthAssertion } from "@/features/payments/paypal-client";
import { PayPalPaymentProvider } from "@/features/payments/paypal-provider";

const config = {
  environment: "sandbox" as const,
  clientId: "platform-client-id",
  clientSecret: "platform-client-secret",
  webhookId: "WH-CONFIGURED",
  partnerMerchantId: "PARTNER-MERCHANT",
  partnerAttributionId: "TIPME_SP_PPCP",
  singleMerchantSandbox: false,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("PayPal partner primitives", () => {
  it("looks up the seller created for TipMe's tracking ID", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/v1/oauth2/token")) return jsonResponse({ access_token: "access", expires_in: 3600 });
      if (url.endsWith("/merchant-integrations?tracking_id=creator-1")) return jsonResponse({ merchant_id: "MERCHANT-1", tracking_id: "creator-1" });
      return jsonResponse({}, 404);
    });
    const client = new PayPalClient(config, fetchImpl as typeof fetch);
    const lookup = (client as unknown as { getMerchantIntegrationByTrackingId?: (trackingId: string) => Promise<unknown> }).getMerchantIntegrationByTrackingId;
    expect(lookup).toBeTypeOf("function");
    if (!lookup) return;

    await expect(lookup.call(client, "creator-1")).resolves.toMatchObject({ merchant_id: "MERCHANT-1" });
  });

  it("creates a partner assertion scoped to the connected creator", () => {
    const assertion = createPayPalAuthAssertion("platform-client-id", "CREATOR-MERCHANT");
    const [header, payload, signature] = assertion.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "none" });
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({ iss: "platform-client-id", payer_id: "CREATOR-MERCHANT" });
    expect(signature).toBe("");
  });

  it("creates a USD order for the creator and separates the configured fee", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url.endsWith("/v1/oauth2/token")) return jsonResponse({ access_token: "access", expires_in: 3600 });
      if (url.endsWith("/v2/checkout/orders")) return jsonResponse({ id: "ORDER-1", status: "CREATED" }, 201);
      if (url.endsWith("/v1/identity/generate-token")) return jsonResponse({ client_token: "client-token" });
      return jsonResponse({ name: "NOT_FOUND" }, 404);
    });
    const client = new PayPalClient(config, fetchImpl as typeof fetch);
    const provider = new PayPalPaymentProvider(client, config);

    const result = await provider.createPayment({
      tipId: "tip-1",
      amountMinor: 2_000,
      platformFeeMinor: 60,
      currency: "USD",
      providerAccountId: "CREATOR-MERCHANT",
      idempotencyKey: "create:tip-1",
    });

    expect(result.providerPaymentId).toBe("ORDER-1");
    expect(result.checkout).toEqual({ kind: "embedded", clientId: "platform-client-id", merchantId: "CREATOR-MERCHANT", clientToken: "client-token", partnerAttributionId: "TIPME_SP_PPCP" });
    const orderCall = fetchImpl.mock.calls.find(([url]) => String(url).endsWith("/v2/checkout/orders"));
    const headers = new Headers(orderCall?.[1]?.headers);
    const payload = JSON.parse(String(orderCall?.[1]?.body));
    expect(headers.get("PayPal-Request-Id")).toBe("create:tip-1");
    expect(headers.get("PayPal-Partner-Attribution-Id")).toBe("TIPME_SP_PPCP");
    expect(payload.application_context).toEqual({
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW",
      landing_page: "BILLING",
    });
    expect(payload.purchase_units[0]).toMatchObject({
      custom_id: "tip-1",
      payee: { merchant_id: "CREATOR-MERCHANT" },
      amount: { currency_code: "USD", value: "20.00" },
      payment_instruction: { disbursement_mode: "INSTANT", platform_fees: [{ amount: { currency_code: "USD", value: "0.60" } }] },
    });
  });

  it("creates a standard Sandbox order without partner-only headers or fields", async () => {
    const standardConfig = { ...config, partnerAttributionId: "MUST-NOT-BE-SENT", singleMerchantSandbox: true };
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/oauth2/token")) return jsonResponse({ access_token: "access", expires_in: 3600 });
      if (url.endsWith("/v2/checkout/orders")) return jsonResponse({ id: "ORDER-STANDARD", status: "CREATED" }, 201);
      if (url.endsWith("/v1/identity/generate-token")) return jsonResponse({ client_token: "client-token" });
      if (url.endsWith("/v2/checkout/orders/ORDER-STANDARD/capture")) return jsonResponse({ purchase_units: [{ payments: { captures: [{ id: "CAPTURE-1", status: "COMPLETED" }] } }] });
      return jsonResponse({ request: init }, 404);
    });
    const provider = new PayPalPaymentProvider(new PayPalClient(standardConfig, fetchImpl as typeof fetch), standardConfig);

    const result = await provider.createPayment({
      tipId: "tip-1", amountMinor: 2_000, platformFeeMinor: 60, currency: "USD",
      providerAccountId: null, idempotencyKey: "create:tip-1",
    });
    await provider.capturePayment({ providerPaymentId: "ORDER-STANDARD", providerAccountId: "PARTNER-MERCHANT", idempotencyKey: "capture:tip-1" });

    expect(result.checkout).toEqual({ kind: "embedded", clientId: "platform-client-id", merchantId: "PARTNER-MERCHANT", clientToken: "client-token" });
    const paypalCalls = fetchImpl.mock.calls.filter(([url]) => !String(url).endsWith("/v1/oauth2/token") && !String(url).endsWith("/v1/identity/generate-token"));
    for (const [, init] of paypalCalls) {
      const headers = new Headers(init?.headers);
      expect(headers.has("PayPal-Partner-Attribution-Id")).toBe(false);
      expect(headers.has("PayPal-Auth-Assertion")).toBe(false);
    }
    const orderCall = fetchImpl.mock.calls.find(([url]) => String(url).endsWith("/v2/checkout/orders"));
    const payload = JSON.parse(String(orderCall?.[1]?.body));
    expect(payload.purchase_units[0]).toEqual({
      reference_id: "tip-1", custom_id: "tip-1", description: "Voluntary support on TipMe",
      amount: { currency_code: "USD", value: "20.00" },
    });
    expect(payload.application_context).toEqual({
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW",
      landing_page: "BILLING",
    });
  });

  it("verifies a webhook with PayPal before parsing money", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/v1/oauth2/token")) return jsonResponse({ access_token: "access", expires_in: 3600 });
      if (url.endsWith("/v1/notifications/verify-webhook-signature")) return jsonResponse({ verification_status: "SUCCESS" });
      return jsonResponse({}, 404);
    });
    const provider = new PayPalPaymentProvider(new PayPalClient(config, fetchImpl as typeof fetch), config);
    const headers = new Headers({
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.paypal.com/cert.pem",
      "paypal-transmission-id": "transmission-1",
      "paypal-transmission-sig": "signature",
      "paypal-transmission-time": "2026-08-16T20:00:00Z",
    });
    await expect(provider.verifyWebhook({ rawBody: JSON.stringify({ id: "WH-1", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: {} }), headers })).resolves.toBe(true);
  });

  it("maps completed capture identifiers and the real PayPal fee", async () => {
    const provider = new PayPalPaymentProvider(new PayPalClient(config, vi.fn() as unknown as typeof fetch), config);
    const event = await provider.parseWebhook(JSON.stringify({
      id: "WH-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      create_time: "2026-08-16T20:00:00.000Z",
      resource: {
        id: "CAPTURE-1",
        supplementary_data: { related_ids: { order_id: "ORDER-1" } },
        seller_receivable_breakdown: { paypal_fee: { currency_code: "USD", value: "1.38" } },
      },
    }));

    expect(event).toMatchObject({ eventId: "WH-1", providerPaymentId: "ORDER-1", providerCaptureId: "CAPTURE-1", status: "confirmed", gatewayFeeMinor: 138 });
  });
});
