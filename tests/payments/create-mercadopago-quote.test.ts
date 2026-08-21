import { describe, expect, it, vi } from "vitest";
import { createMercadoPagoQuote } from "@/features/payments/create-mercadopago-quote";
import { verifyPaymentQuote } from "@/lib/security/payment-quote";

function dependencies() {
  return {
    creators: { findCreatorByUsername: vi.fn().mockResolvedValue({ id: "creator-1", currency: "USD" }) },
    paymentAccounts: { findConnected: vi.fn().mockResolvedValue({
      id: "account-1", providerMerchantId: "seller-1", cardPaymentsEnabled: true, country: "PE", currency: "PEN",
    }) },
    credentials: { findByAccountId: vi.fn().mockResolvedValue({ accessToken: "seller-token" }) },
    getRate: vi.fn().mockResolvedValue({ rate: 3.361, quotedAt: "2026-08-21T00:00:00.000Z" }),
    signingSecret: "quote-test-secret",
    now: new Date("2026-08-21T15:00:00.000Z"),
  };
}

describe("createMercadoPagoQuote", () => {
  it("issues a signed local quote for the connected creator", async () => {
    const result = await createMercadoPagoQuote({ username: "camila", amountUsdMinor: 2_000 }, dependencies());
    expect(result).toMatchObject({ amountUsdMinor: 2_000, localAmountMinor: 6_722, currency: "PEN", rate: 3.361 });
    expect(verifyPaymentQuote(result.quoteToken, "quote-test-secret", new Date("2026-08-21T15:09:00.000Z")))
      .toMatchObject({ creatorId: "creator-1", paymentAccountId: "account-1", localAmountMinor: 6_722 });
  });

  it("does not quote a creator without a connected Mercado Pago account", async () => {
    const deps = dependencies();
    deps.paymentAccounts.findConnected.mockResolvedValue(null);
    await expect(createMercadoPagoQuote({ username: "camila", amountUsdMinor: 2_000 }, deps))
      .rejects.toThrow("mercadopago_account_not_connected");
    expect(deps.getRate).not.toHaveBeenCalled();
  });
});
