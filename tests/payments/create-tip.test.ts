import { describe, expect, it, vi } from "vitest";
import { createTip, type TipRepository } from "@/features/payments/create-tip";
import type { PaymentProvider } from "@/features/payments/provider";

function dependencies(providerName: "mock" | "paypal" = "mock", connectedMerchant: string | null = null) {
  const repository: TipRepository = {
    findCreatorByUsername: vi.fn().mockResolvedValue({ id: "creator-1", currency: "USD" }),
    insertTip: vi.fn().mockResolvedValue({ id: "tip-1" }),
    attachPayment: vi.fn().mockResolvedValue(undefined),
  };
  const provider: PaymentProvider = {
    name: providerName,
    createPayment: vi.fn().mockResolvedValue(providerName === "mock"
      ? { providerPaymentId: "mock_pay_1", status: "pending", checkout: { kind: "redirect", url: "/pay/mock/mock_pay_1" }, gatewayFeeMinor: null }
      : { providerPaymentId: "ORDER-1", status: "pending", checkout: { kind: "embedded", clientId: "client", merchantId: "MERCHANT-1", clientToken: "token", partnerAttributionId: "BN" }, gatewayFeeMinor: null }),
    getPaymentStatus: vi.fn(), capturePayment: vi.fn(), verifyWebhook: vi.fn(), parseWebhook: vi.fn(), createPayout: vi.fn(), getPayoutStatus: vi.fn(),
  };
  const paymentAccounts = { findConnected: vi.fn().mockResolvedValue(connectedMerchant ? { id: "account-1", providerMerchantId: connectedMerchant, cardPaymentsEnabled: true } : null) };
  return { repository, provider, paymentAccounts };
}

describe("createTip", () => {
  it("permite crear un tip sin sesión fan", async () => {
    const { repository, provider } = dependencies();
    const result = await createTip({ username: "camila", amountMinor: 2_000, payerName: "Mateo", message: "Prueba ❤️", anonymous: false }, { repository, provider, platformFeeBps: 300 });

    expect(result).toEqual({ tipId: "tip-1", providerPaymentId: "mock_pay_1", status: "pending", checkout: { kind: "redirect", url: "/pay/mock/mock_pay_1" } });
    expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 2_000, platformFeeMinor: 60, netAmountMinor: 1_940, currency: "USD", payerName: "Mateo" }));
  });

  it("requires a verified connected PayPal account", async () => {
    const deps = dependencies("paypal", null);
    await expect(createTip({ username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true }, { ...deps, platformFeeBps: 300 })).rejects.toThrow("paypal_account_not_connected");
    expect(deps.provider.createPayment).not.toHaveBeenCalled();
  });

  it("directs the PayPal order to the verified creator merchant", async () => {
    const deps = dependencies("paypal", "MERCHANT-1");
    await createTip({ username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true }, { ...deps, platformFeeBps: 300 });
    expect(deps.provider.createPayment).toHaveBeenCalledWith(expect.objectContaining({ providerAccountId: "MERCHANT-1", platformFeeMinor: 60 }));
  });

  it("uses the platform Sandbox merchant without a connected creator account", async () => {
    const deps = dependencies("paypal", null);
    await createTip(
      { username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true },
      { ...deps, platformFeeBps: 300, providerAccountOverride: "PARTNER-MERCHANT" },
    );
    expect(deps.paymentAccounts.findConnected).not.toHaveBeenCalled();
    expect(deps.provider.createPayment).toHaveBeenCalledWith(expect.objectContaining({ providerAccountId: "PARTNER-MERCHANT" }));
  });

  it("fuerza USD aunque el perfil conserve otra moneda", async () => {
    const { repository, provider } = dependencies();
    vi.mocked(repository.findCreatorByUsername).mockResolvedValue({ id: "creator-1", currency: "EUR" });

    await createTip({ username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true }, { repository, provider, platformFeeBps: 300 });

    expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD" }));
    expect(provider.createPayment).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD" }));
  });

  it("elimina la identidad antes de persistir un tip anónimo", async () => {
    const { repository, provider } = dependencies();
    await createTip({ username: "camila", amountMinor: 2_000, payerName: "Nombre secreto", message: "Hola", anonymous: true }, { repository, provider, platformFeeBps: 300 });
    expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({ payerName: null, anonymous: true }));
  });

  it.each([
    { username: "camila", amountMinor: 0 },
    { username: "camila", amountMinor: 10.5 },
    { username: "camila", amountMinor: 1_000_001 },
    { username: "camila", amountMinor: 2000, payerName: "x".repeat(61) },
    { username: "camila", amountMinor: 2000, message: "x".repeat(281) },
  ])("rechaza input inseguro %#", async (input) => {
    const { repository, provider } = dependencies();
    await expect(createTip({ payerName: null, message: null, anonymous: false, ...input }, { repository, provider, platformFeeBps: 300 })).rejects.toThrow();
    expect(repository.insertTip).not.toHaveBeenCalled();
  });

  it("rechaza una creadora inexistente", async () => {
    const { repository, provider } = dependencies();
    vi.mocked(repository.findCreatorByUsername).mockResolvedValue(null);
    await expect(createTip({ username: "missing", amountMinor: 2_000, payerName: null, message: null, anonymous: true }, { repository, provider, platformFeeBps: 300 })).rejects.toThrow("creator_not_found");
  });
});
