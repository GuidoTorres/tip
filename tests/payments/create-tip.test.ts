import { describe, expect, it, vi } from "vitest";
import { createTip, type TipRepository } from "@/features/payments/create-tip";
import type { PaymentProvider } from "@/features/payments/provider";
import { CURRENT_LEGAL_TERMS_VERSION } from "@/features/legal/terms";

const legalAcceptance = { legalAccepted: true, legalTermsVersion: CURRENT_LEGAL_TERMS_VERSION } as const;

function dependencies(providerName = "test", connectedMerchant: string | null = null) {
  const repository: TipRepository = {
    findCreatorByUsername: vi.fn().mockResolvedValue({ id: "creator-1", currency: "USD" }),
    insertTip: vi.fn().mockResolvedValue({ id: "tip-1" }),
    attachPayment: vi.fn().mockResolvedValue(undefined),
  };
  const provider: PaymentProvider = {
    name: providerName,
    createPayment: vi.fn().mockResolvedValue({
      providerPaymentId: "payment-1",
      status: "pending",
      checkout: { kind: "redirect", url: "https://checkout.example/payment-1" },
      gatewayFeeMinor: null,
    }),
    getPaymentStatus: vi.fn(),
    capturePayment: vi.fn(),
    verifyWebhook: vi.fn(),
    parseWebhook: vi.fn(),
  };
  const paymentAccounts = { findConnected: vi.fn().mockResolvedValue(connectedMerchant ? {
    id: "account-1", providerMerchantId: connectedMerchant, cardPaymentsEnabled: true,
  } : null) };
  const payoutDestinations = { findConfigured: vi.fn().mockResolvedValue(connectedMerchant ? { id: "payout-1", status: "verified" as const } : null) };
  return { repository, provider, paymentAccounts, payoutDestinations };
}

describe("createTip", () => {
  it("rejects a tip when the fan did not accept the current legal terms", async () => {
    const { repository, provider } = dependencies();

    await expect(createTip({
      username: "camila", amountMinor: 2_000, payerName: null, message: null,
      anonymous: true, legalAccepted: false, legalTermsVersion: CURRENT_LEGAL_TERMS_VERSION,
    }, { repository, provider, platformFeeBps: 300 })).rejects.toThrow("legal_acceptance_required");

    expect(repository.insertTip).not.toHaveBeenCalled();
  });

  it("persists the server-controlled legal version and acceptance timestamp", async () => {
    const { repository, provider } = dependencies();

    await createTip({
      username: "camila", amountMinor: 2_000, payerName: null, message: null,
      anonymous: true, ...legalAcceptance,
    }, { repository, provider, platformFeeBps: 300 });

    expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({
      legalTermsVersion: CURRENT_LEGAL_TERMS_VERSION,
      legalAcceptedAt: expect.any(String),
    }));
  });

  it("creates a USD tip without a fan session", async () => {
    const { repository, provider } = dependencies();
    const result = await createTip(
      { username: "camila", amountMinor: 2_000, payerName: "Mateo", message: "Gracias", anonymous: false, ...legalAcceptance },
      { repository, provider, platformFeeBps: 300 },
    );

    expect(result).toEqual({
      tipId: "tip-1", providerPaymentId: "payment-1", status: "pending",
      checkout: { kind: "redirect", url: "https://checkout.example/payment-1" },
    });
    expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({
      amountMinor: 2_000, platformFeeMinor: 60, netAmountMinor: 1_940, currency: "USD", payerName: "Mateo",
    }));
  });

  it("calculates voluntary processing support on the server", async () => {
    const deps = dependencies();

    await createTip(
      { username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, coverProcessing: true, ...legalAcceptance },
      { ...deps, platformFeeBps: 0, checkoutFeeBps: 540, checkoutFixedFeeMinor: 30 },
    );

    expect(deps.repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({
      baseAmountMinor: 2_000, processingSupportMinor: 146, amountMinor: 2_146, platformFeeMinor: 0, netAmountMinor: 2_000,
    }));
    expect(deps.provider.createPayment).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 2_146, providerAccountId: null }));
    expect(deps.paymentAccounts.findConnected).not.toHaveBeenCalled();
  });

  it("forces USD when a legacy profile stores another currency", async () => {
    const { repository, provider } = dependencies();
    vi.mocked(repository.findCreatorByUsername).mockResolvedValue({ id: "creator-1", currency: "EUR" });

    await createTip(
      { username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance },
      { repository, provider, platformFeeBps: 300 },
    );

    expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD" }));
    expect(provider.createPayment).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD" }));
  });

  it("derives anonymity from an empty optional payer name", async () => {
    const { repository, provider } = dependencies();
    await createTip(
      { username: "camila", amountMinor: 2_000, payerName: "", message: "Hola", anonymous: false, ...legalAcceptance },
      { repository, provider, platformFeeBps: 300 },
    );
    expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({ payerName: null, anonymous: true }));
  });

  it("keeps a provided payer name visible regardless of a stale client flag", async () => {
    const { repository, provider } = dependencies();
    await createTip(
      { username: "camila", amountMinor: 2_000, payerName: "Mateo", message: "Hola", anonymous: true, ...legalAcceptance },
      { repository, provider, platformFeeBps: 300 },
    );
    expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({ payerName: "Mateo", anonymous: false }));
  });

  it.each([
    { username: "camila", amountMinor: 0 },
    { username: "camila", amountMinor: 10.5 },
    { username: "camila", amountMinor: 1_000_001 },
    { username: "camila", amountMinor: 2000, payerName: "x".repeat(61) },
    { username: "camila", amountMinor: 2000, message: "x".repeat(281) },
  ])("rejects unsafe input %#", async (input) => {
    const { repository, provider } = dependencies();
    await expect(createTip(
      { payerName: null, message: null, anonymous: false, ...legalAcceptance, ...input },
      { repository, provider, platformFeeBps: 300 },
    )).rejects.toThrow();
    expect(repository.insertTip).not.toHaveBeenCalled();
  });

  it("uses the saved PayPal payout destination in platform payout mode", async () => {
    const deps = dependencies("paypal", "creator-paypal@example.com");

    await createTip(
      { username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance },
      { ...deps, platformFeeBps: 300, paypalFlow: "platform_payouts" },
    );

    expect(deps.payoutDestinations.findConfigured).toHaveBeenCalledWith("creator-1");
    expect(deps.repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({ provider: "paypal" }));
  });

  it("uses the connected PayPal merchant in multiparty mode", async () => {
    const deps = dependencies("paypal", "merchant-1");

    await createTip(
      { username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance },
      { ...deps, platformFeeBps: 300, paypalFlow: "multiparty" },
    );

    expect(deps.paymentAccounts.findConnected).toHaveBeenCalledWith("creator-1", "paypal");
    expect(deps.provider.createPayment).toHaveBeenCalledWith(expect.objectContaining({ providerAccountId: "merchant-1" }));
  });

  it("fails closed when the PayPal merchant is missing in multiparty mode", async () => {
    const deps = dependencies("paypal");

    await expect(createTip(
      { username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance },
      { ...deps, platformFeeBps: 300, paypalFlow: "multiparty" },
    )).rejects.toThrow("paypal_account_not_connected");
    expect(deps.repository.insertTip).not.toHaveBeenCalled();
  });

  it("rejects a missing creator", async () => {
    const { repository, provider } = dependencies();
    vi.mocked(repository.findCreatorByUsername).mockResolvedValue(null);
    await expect(createTip(
      { username: "missing", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance },
      { repository, provider, platformFeeBps: 300 },
    )).rejects.toThrow("creator_not_found");
  });
});
