import { describe, expect, it, vi } from "vitest";
import { createTip, type TipRepository } from "@/features/payments/create-tip";
import type { PaymentProvider } from "@/features/payments/provider";
import { createPaymentQuote } from "@/lib/security/payment-quote";

const legalAcceptance = { legalAccepted: true, legalTermsVersion: "2026-08-20" } as const;

function dependencies(providerName: "mock" | "paypal" | "mercadopago" = "mock", connectedMerchant: string | null = null) {
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
  const paymentAccounts = { findConnected: vi.fn().mockResolvedValue(connectedMerchant ? {
    id: "account-1", providerMerchantId: connectedMerchant, cardPaymentsEnabled: true,
    country: providerName === "mercadopago" ? "PE" : null, currency: providerName === "mercadopago" ? "PEN" : null,
  } : null) };
  const mercadoPagoCredentials = { findByAccountId: vi.fn().mockResolvedValue({ accessToken: "seller-token" }) };
  return { repository, provider, paymentAccounts, mercadoPagoCredentials };
}

describe("createTip", () => {
  it("rejects a tip when the fan did not accept the current legal terms", async () => {
    const { repository, provider } = dependencies();

    await expect(createTip({
      username: "camila", amountMinor: 2_000, payerName: null, message: null,
      anonymous: true, legalAccepted: false, legalTermsVersion: "2026-08-20",
    }, { repository, provider, platformFeeBps: 300 })).rejects.toThrow("legal_acceptance_required");

    expect(repository.insertTip).not.toHaveBeenCalled();
  });

  it("persists the server-controlled legal version and acceptance timestamp", async () => {
    const { repository, provider } = dependencies();

    await createTip({
      username: "camila", amountMinor: 2_000, payerName: null, message: null,
      anonymous: true, legalAccepted: true, legalTermsVersion: "2026-08-20",
    }, { repository, provider, platformFeeBps: 300 });

    expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({
      legalTermsVersion: "2026-08-20",
      legalAcceptedAt: expect.any(String),
    }));
  });

  it("permite crear un tip sin sesión fan", async () => {
    const { repository, provider } = dependencies();
    const result = await createTip({ username: "camila", amountMinor: 2_000, payerName: "Mateo", message: "Prueba ❤️", anonymous: false, ...legalAcceptance }, { repository, provider, platformFeeBps: 300 });

    expect(result).toEqual({ tipId: "tip-1", providerPaymentId: "mock_pay_1", status: "pending", checkout: { kind: "redirect", url: "/pay/mock/mock_pay_1" } });
    expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 2_000, platformFeeMinor: 60, netAmountMinor: 1_940, currency: "USD", payerName: "Mateo" }));
  });

  it("requires a verified connected PayPal account", async () => {
    const deps = dependencies("paypal", null);
    await expect(createTip({ username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance }, { ...deps, platformFeeBps: 300 })).rejects.toThrow("paypal_account_not_connected");
    expect(deps.provider.createPayment).not.toHaveBeenCalled();
  });

  it("directs the PayPal order to the verified creator merchant", async () => {
    const deps = dependencies("paypal", "MERCHANT-1");
    await createTip({ username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance }, { ...deps, platformFeeBps: 300 });
    expect(deps.provider.createPayment).toHaveBeenCalledWith(expect.objectContaining({ providerAccountId: "MERCHANT-1", platformFeeMinor: 60 }));
  });

  it("requires a configured PayPal payout destination in platform payouts mode", async () => {
    const deps = dependencies("paypal", null);
    const payoutDestinations = { findConfigured: vi.fn().mockResolvedValue(null) };

    await expect(createTip(
      { username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, coverProcessing: false, ...legalAcceptance },
      { ...deps, payoutDestinations, paypalFlow: "platform_payouts", platformFeeBps: 0, checkoutFeeBps: 540, checkoutFixedFeeMinor: 30 },
    )).rejects.toThrow("paypal_account_not_connected");

    expect(deps.provider.createPayment).not.toHaveBeenCalled();
  });

  it("calculates voluntary processing support on the server", async () => {
    const deps = dependencies("paypal", null);
    const payoutDestinations = { findConfigured: vi.fn().mockResolvedValue({ id: "destination-1", status: "pending" }) };

    await createTip(
      { username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, coverProcessing: true, ...legalAcceptance },
      { ...deps, payoutDestinations, paypalFlow: "platform_payouts", platformFeeBps: 0, checkoutFeeBps: 540, checkoutFixedFeeMinor: 30 },
    );

    expect(deps.repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({
      baseAmountMinor: 2_000,
      processingSupportMinor: 146,
      amountMinor: 2_146,
      platformFeeMinor: 0,
      netAmountMinor: 2_000,
    }));
    expect(deps.provider.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      amountMinor: 2_146,
      providerAccountId: null,
    }));
    expect(deps.paymentAccounts.findConnected).not.toHaveBeenCalled();
  });

  it("uses the platform Sandbox merchant without a connected creator account", async () => {
    const deps = dependencies("paypal", null);
    await createTip(
      { username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance },
      { ...deps, platformFeeBps: 300, providerAccountOverride: "PARTNER-MERCHANT" },
    );
    expect(deps.paymentAccounts.findConnected).not.toHaveBeenCalled();
    expect(deps.provider.createPayment).toHaveBeenCalledWith(expect.objectContaining({ providerAccountId: "PARTNER-MERCHANT" }));
  });

  it("fuerza USD aunque el perfil conserve otra moneda", async () => {
    const { repository, provider } = dependencies();
    vi.mocked(repository.findCreatorByUsername).mockResolvedValue({ id: "creator-1", currency: "EUR" });

    await createTip({ username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance }, { repository, provider, platformFeeBps: 300 });

    expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD" }));
    expect(provider.createPayment).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD" }));
  });

  it("charges Mercado Pago with the signed local quote and stores the USD reference", async () => {
    const deps = dependencies("mercadopago", "seller-1");
    const quoteToken = createPaymentQuote({
      creatorId: "creator-1", paymentAccountId: "account-1", amountUsdMinor: 2_000,
      localAmountMinor: 6_722, currency: "PEN", rate: 3.361,
      quotedAt: "2026-08-21T15:00:00.000Z", expiresAt: "2099-08-21T15:10:00.000Z", source: "mercadopago",
    }, "quote-test-secret");

    await createTip({
      username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true,
      quoteToken, paymentMethodData: { token: "card-token", paymentMethodId: "visa", installments: 1, payer: { email: "fan@example.com" } },
      ...legalAcceptance,
    }, { ...deps, platformFeeBps: 100, quoteSigningSecret: "quote-test-secret" });

    expect(deps.repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({
      displayAmountUsdMinor: 2_000, baseAmountMinor: 6_722, amountMinor: 6_722,
      currency: "PEN", exchangeRate: 3.361, platformFeeMinor: 67,
    }));
    expect(deps.provider.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      amountMinor: 6_722, currency: "PEN", platformFeeMinor: 67,
    }));
  });

  it("rejects a quote signed for another creator before creating a payment", async () => {
    const deps = dependencies("mercadopago", "seller-1");
    const quoteToken = createPaymentQuote({
      creatorId: "creator-2", paymentAccountId: "account-1", amountUsdMinor: 2_000,
      localAmountMinor: 6_722, currency: "PEN", rate: 3.361,
      quotedAt: "2026-08-21T15:00:00.000Z", expiresAt: "2099-08-21T15:10:00.000Z", source: "mercadopago",
    }, "quote-test-secret");

    await expect(createTip({
      username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true,
      quoteToken, paymentMethodData: { token: "card-token", paymentMethodId: "visa", installments: 1, payer: { email: "fan@example.com" } },
      ...legalAcceptance,
    }, { ...deps, platformFeeBps: 100, quoteSigningSecret: "quote-test-secret" })).rejects.toThrow("payment_quote_mismatch");

    expect(deps.repository.insertTip).not.toHaveBeenCalled();
    expect(deps.provider.createPayment).not.toHaveBeenCalled();
  });

  it("derives anonymity when the optional payer name is empty", async () => {
    const { repository, provider } = dependencies();
    await createTip({ username: "camila", amountMinor: 2_000, payerName: "", message: "Hola", anonymous: false, ...legalAcceptance }, { repository, provider, platformFeeBps: 300 });
    expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({ payerName: null, anonymous: true }));
  });

  it("keeps a provided payer name visible regardless of a stale client flag", async () => {
    const { repository, provider } = dependencies();
    await createTip({ username: "camila", amountMinor: 2_000, payerName: "Mateo", message: "Hola", anonymous: true, ...legalAcceptance }, { repository, provider, platformFeeBps: 300 });
    expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({ payerName: "Mateo", anonymous: false }));
  });

  it.each([
    { username: "camila", amountMinor: 0 },
    { username: "camila", amountMinor: 10.5 },
    { username: "camila", amountMinor: 1_000_001 },
    { username: "camila", amountMinor: 2000, payerName: "x".repeat(61) },
    { username: "camila", amountMinor: 2000, message: "x".repeat(281) },
  ])("rechaza input inseguro %#", async (input) => {
    const { repository, provider } = dependencies();
    await expect(createTip({ payerName: null, message: null, anonymous: false, ...legalAcceptance, ...input }, { repository, provider, platformFeeBps: 300 })).rejects.toThrow();
    expect(repository.insertTip).not.toHaveBeenCalled();
  });

  it("rechaza una creadora inexistente", async () => {
    const { repository, provider } = dependencies();
    vi.mocked(repository.findCreatorByUsername).mockResolvedValue(null);
    await expect(createTip({ username: "missing", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance }, { repository, provider, platformFeeBps: 300 })).rejects.toThrow("creator_not_found");
  });
});
