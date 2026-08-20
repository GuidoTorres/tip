import { describe, expect, it, vi } from "vitest";
import { PayPalClient } from "@/features/payments/paypal-client";
import { PayPalPaymentProvider } from "@/features/payments/paypal-provider";
import { prepareCheckout } from "@/features/payments/prepare-checkout";
import type { PaymentProvider } from "@/features/payments/provider";

const config = {
  environment: "sandbox" as const,
  clientId: "platform-client-id",
  clientSecret: "platform-client-secret",
  webhookId: "WH-CONFIGURED",
  partnerMerchantId: "PARTNER-MERCHANT",
  partnerAttributionId: "TIPME_SP_PPCP",
  singleMerchantSandbox: false,
  flow: "platform_payouts" as const,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function nonPaymentMethods(): Pick<PaymentProvider, "getPaymentStatus" | "capturePayment" | "verifyWebhook" | "parseWebhook" | "createPayout" | "getPayoutStatus"> {
  return {
    getPaymentStatus: vi.fn(),
    capturePayment: vi.fn(),
    verifyWebhook: vi.fn(),
    parseWebhook: vi.fn(),
    createPayout: vi.fn(),
    getPayoutStatus: vi.fn(),
  };
}

describe("prepareCheckout", () => {
  it("prepares PayPal browser configuration without creating an order", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/v1/oauth2/token")) return jsonResponse({ access_token: "access", expires_in: 3600 });
      if (url.endsWith("/v1/identity/generate-token")) return jsonResponse({ client_token: "client-token" });
      return jsonResponse({ name: "UNEXPECTED_REQUEST" }, 500);
    });
    const provider = new PayPalPaymentProvider(new PayPalClient(config, fetchImpl as typeof fetch), config);

    const result = await prepareCheckout({ username: "camila" }, {
      provider,
      creators: { findCreatorByUsername: vi.fn().mockResolvedValue({ id: "creator-1", currency: "USD" }) },
      payoutDestinations: { findConfigured: vi.fn().mockResolvedValue({ id: "destination-1", status: "pending" }) },
      paypalFlow: "platform_payouts",
    });

    expect(result).toEqual({
      kind: "embedded",
      checkout: { kind: "embedded", clientId: "platform-client-id", clientToken: "client-token" },
    });
    expect(fetchImpl.mock.calls.some(([url]) => String(url).endsWith("/v2/checkout/orders"))).toBe(false);
  });

  it("does not request a second client token while creating the PayPal order", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/v1/oauth2/token")) return jsonResponse({ access_token: "access", expires_in: 3600 });
      if (url.endsWith("/v2/checkout/orders")) return jsonResponse({ id: "ORDER-1", status: "CREATED" }, 201);
      return jsonResponse({ name: "UNEXPECTED_REQUEST" }, 500);
    });
    const provider = new PayPalPaymentProvider(new PayPalClient(config, fetchImpl as typeof fetch), config);

    const result = await provider.createPayment({
      tipId: "tip-1",
      amountMinor: 2_000,
      platformFeeMinor: 0,
      currency: "USD",
      providerAccountId: null,
      idempotencyKey: "create:tip-1",
    });

    expect(result.checkout).toBeUndefined();
    expect(fetchImpl.mock.calls.some(([url]) => String(url).endsWith("/v1/identity/generate-token"))).toBe(false);
  });

  it("keeps providers without embedded preparation in redirect mode", async () => {
    const provider: PaymentProvider = {
      name: "mock",
      createPayment: vi.fn(),
      ...nonPaymentMethods(),
    };

    const result = await prepareCheckout({ username: "camila" }, {
      provider,
      creators: { findCreatorByUsername: vi.fn().mockResolvedValue({ id: "creator-1", currency: "USD" }) },
    });

    expect(result).toEqual({ kind: "redirect" });
  });

  it("does not expose checkout when a centralized creator lacks a payout destination", async () => {
    const provider: PaymentProvider = {
      name: "paypal",
      prepareCheckout: vi.fn(),
      createPayment: vi.fn(),
      ...nonPaymentMethods(),
    };

    await expect(prepareCheckout({ username: "camila" }, {
      provider,
      creators: { findCreatorByUsername: vi.fn().mockResolvedValue({ id: "creator-1", currency: "USD" }) },
      payoutDestinations: { findConfigured: vi.fn().mockResolvedValue(null) },
      paypalFlow: "platform_payouts",
    })).rejects.toThrow("paypal_account_not_connected");

    expect(provider.prepareCheckout).not.toHaveBeenCalled();
  });
});
