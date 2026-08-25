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

describe("prepareCheckout", () => {
  it("prepares the embedded PayPal gateway for a creator with a payout destination", async () => {
    const checkout = {
      kind: "embedded" as const,
      clientId: "paypal-client-id",
      clientToken: "paypal-client-token",
    };
    const provider: PaymentProvider = {
      name: "paypal",
      prepareCheckout: vi.fn().mockResolvedValue(checkout),
      createPayment: vi.fn(),
      ...nonPaymentMethods(),
    };

    const result = await prepareCheckout({ username: "camila" }, {
      provider,
      creators: { findCreatorByUsername: vi.fn().mockResolvedValue({ id: "creator-1", currency: "USD" }) },
      payoutDestinations: { findConfigured: vi.fn().mockResolvedValue({ id: "destination-1", status: "pending" }) },
      paypalFlow: "platform_payouts",
    });

    expect(result).toEqual({ kind: "embedded", checkout });
  });

  it("does not expose PayPal checkout without a payout destination", async () => {
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

  it("fails closed when a Mercado Pago creator has no connected account", async () => {
    const provider: PaymentProvider = {
      name: "mercadopago",
      createPayment: vi.fn(),
      ...nonPaymentMethods(),
    };

    await expect(prepareCheckout({ username: "camila" }, {
      provider,
      creators: { findCreatorByUsername: vi.fn().mockResolvedValue({ id: "creator-1", currency: "PEN" }) },
      paymentAccounts: { findConnected: vi.fn().mockResolvedValue(null) },
    })).rejects.toThrow("mercadopago_account_not_connected");
  });

  it("fails closed when a dLocal Go creator has no split contract", async () => {
    const provider: PaymentProvider = { name: "dlocalgo", createPayment: vi.fn(), ...nonPaymentMethods() };

    await expect(prepareCheckout({ username: "camila" }, {
      provider,
      creators: { findCreatorByUsername: vi.fn().mockResolvedValue({ id: "creator-1", currency: "USD" }) },
      paymentAccounts: { findConnected: vi.fn().mockResolvedValue(null) },
    })).rejects.toThrow("dlocalgo_account_not_connected");
  });

  it("keeps a connected dLocal Go creator in redirect mode", async () => {
    const provider: PaymentProvider = { name: "dlocalgo", createPayment: vi.fn(), ...nonPaymentMethods() };
    const findConnected = vi.fn().mockResolvedValue({
      id: "account-1", providerMerchantId: "SPLIT-1", cardPaymentsEnabled: false, country: null, currency: null,
    });

    const result = await prepareCheckout({ username: "camila" }, {
      provider,
      creators: { findCreatorByUsername: vi.fn().mockResolvedValue({ id: "creator-1", currency: "USD" }) },
      paymentAccounts: { findConnected },
    });

    expect(findConnected).toHaveBeenCalledWith("creator-1", "dlocalgo");
    expect(result).toEqual({ kind: "redirect" });
  });

  it("fails closed when a Whop creator has not activated payments", async () => {
    const provider: PaymentProvider = { name: "whop", createPayment: vi.fn(), ...nonPaymentMethods() };

    await expect(prepareCheckout({ username: "camila" }, {
      provider,
      creators: { findCreatorByUsername: vi.fn().mockResolvedValue({ id: "creator-1", currency: "USD" }) },
      paymentAccounts: { findConnected: vi.fn().mockResolvedValue(null) },
    })).rejects.toThrow("whop_account_not_connected");
  });

  it("allows redirect checkout after Whop is connected", async () => {
    const provider: PaymentProvider = { name: "whop", createPayment: vi.fn(), ...nonPaymentMethods() };
    const findConnected = vi.fn().mockResolvedValue({
      id: "account-1", providerMerchantId: "biz_creator", cardPaymentsEnabled: true, country: null, currency: "USD",
    });

    await expect(prepareCheckout({ username: "camila" }, {
      provider,
      creators: { findCreatorByUsername: vi.fn().mockResolvedValue({ id: "creator-1", currency: "USD" }) },
      paymentAccounts: { findConnected },
    })).resolves.toEqual({ kind: "redirect" });
    expect(findConnected).toHaveBeenCalledWith("creator-1", "whop");
  });
});
