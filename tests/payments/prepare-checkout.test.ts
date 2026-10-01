import { describe, expect, it, vi } from "vitest";
import { prepareCheckout } from "@/features/payments/prepare-checkout";
import type { PaymentProvider } from "@/features/payments/provider";

function nonPaymentMethods(): Pick<PaymentProvider, "getPaymentStatus" | "capturePayment" | "verifyWebhook" | "parseWebhook"> {
  return {
    getPaymentStatus: vi.fn(),
    capturePayment: vi.fn(),
    verifyWebhook: vi.fn(),
    parseWebhook: vi.fn(),
  };
}

function paypalProvider(checkout: { kind: "embedded"; clientId: string; clientToken: string } | null = {
  kind: "embedded", clientId: "paypal-client-id", clientToken: "paypal-client-token",
}): PaymentProvider {
  return {
    name: "paypal",
    prepareCheckout: vi.fn().mockResolvedValue(checkout),
    createPayment: vi.fn(),
    ...nonPaymentMethods(),
  };
}

const creator = { findCreatorByUsername: vi.fn().mockResolvedValue({ id: "creator-1", currency: "USD" }) };

describe("prepareCheckout", () => {
  it("prepares embedded PayPal checkout for a creator with a payout destination", async () => {
    const provider = paypalProvider();

    const result = await prepareCheckout({ username: "camila" }, {
      provider,
      creators: creator,
      payoutDestinations: { findConfigured: vi.fn().mockResolvedValue({ id: "destination-1", status: "pending" }) },
      paypalFlow: "platform_payouts",
    });

    expect(result).toEqual({
      kind: "embedded",
      checkout: { kind: "embedded", clientId: "paypal-client-id", clientToken: "paypal-client-token" },
    });
  });

  it("does not expose PayPal checkout without a payout destination", async () => {
    await expect(prepareCheckout({ username: "camila" }, {
      provider: paypalProvider(),
      creators: creator,
      payoutDestinations: { findConfigured: vi.fn().mockResolvedValue(null) },
      paypalFlow: "platform_payouts",
    })).rejects.toThrow("paypal_account_not_connected");
  });

  it("prepares multiparty checkout for the connected PayPal merchant", async () => {
    const provider = paypalProvider();

    await expect(prepareCheckout({ username: "camila" }, {
      provider,
      creators: creator,
      paymentAccounts: { findConnected: vi.fn().mockResolvedValue({
        id: "account-1", providerMerchantId: "merchant-1", cardPaymentsEnabled: true,
      }) },
      paypalFlow: "multiparty",
    })).resolves.toMatchObject({ kind: "embedded" });
    expect(provider.prepareCheckout).toHaveBeenCalledWith({ providerAccountId: "merchant-1" });
  });

  it("fails closed when a multiparty PayPal merchant is missing", async () => {
    await expect(prepareCheckout({ username: "camila" }, {
      provider: paypalProvider(),
      creators: creator,
      paymentAccounts: { findConnected: vi.fn().mockResolvedValue(null) },
      paypalFlow: "multiparty",
    })).rejects.toThrow("paypal_account_not_connected");
  });

  it("uses the configured PayPal merchant override in sandbox", async () => {
    const provider = paypalProvider();
    const findConnected = vi.fn();

    await prepareCheckout({ username: "camila" }, {
      provider,
      creators: creator,
      paymentAccounts: { findConnected },
      providerAccountOverride: "sandbox-merchant",
      paypalFlow: "multiparty",
    });

    expect(findConnected).not.toHaveBeenCalled();
    expect(provider.prepareCheckout).toHaveBeenCalledWith({ providerAccountId: "sandbox-merchant" });
  });

  it("keeps a provider-neutral redirect seam for Stripe", async () => {
    const provider: PaymentProvider = { name: "stripe", createPayment: vi.fn(), ...nonPaymentMethods() };

    await expect(prepareCheckout({ username: "camila" }, {
      provider,
      creators: creator,
    })).resolves.toEqual({ kind: "redirect" });
  });
});
