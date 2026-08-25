import { describe, expect, it, vi } from "vitest";
import { createTip, type TipRepository } from "@/features/payments/create-tip";
import type { PaymentProvider } from "@/features/payments/provider";
import { createPaymentQuote } from "@/lib/security/payment-quote";
import { CURRENT_LEGAL_TERMS_VERSION } from "@/features/legal/terms";

const legalAcceptance = { legalAccepted: true, legalTermsVersion: CURRENT_LEGAL_TERMS_VERSION } as const;

function dependencies(providerName: "mock" | "paypal" | "mercadopago" | "dlocalgo" | "whop" = "mock", connectedMerchant: string | null = null) {
  const repository: TipRepository = {
    findCreatorByUsername: vi.fn().mockResolvedValue({ id: "creator-1", currency: "USD" }),
    insertTip: vi.fn().mockResolvedValue({ id: "tip-1" }),
    attachPayment: vi.fn().mockResolvedValue(undefined),
  };
  const provider: PaymentProvider = {
    name: providerName,
    createPayment: vi.fn().mockResolvedValue(providerName === "mock"
      ? { providerPaymentId: "mock_pay_1", status: "pending", checkout: { kind: "redirect", url: "/pay/mock/mock_pay_1" }, gatewayFeeMinor: null }
      : { providerPaymentId: "MP-1", status: "pending", gatewayFeeMinor: null }),
    getPaymentStatus: vi.fn(), capturePayment: vi.fn(), verifyWebhook: vi.fn(), parseWebhook: vi.fn(),
  };
  const paymentAccounts = { findConnected: vi.fn().mockResolvedValue(connectedMerchant ? {
    id: "account-1", providerMerchantId: connectedMerchant, cardPaymentsEnabled: true,
    country: providerName === "mercadopago" ? "PE" : null, currency: providerName === "mercadopago" ? "PEN" : null,
  } : null) };
  const payoutDestinations = { findConfigured: vi.fn().mockResolvedValue(connectedMerchant ? { id: "payout-1", status: "verified" as const } : null) };
  const mercadoPagoCredentials = { findByAccountId: vi.fn().mockResolvedValue({ accessToken: "seller-token" }) };
  return { repository, provider, paymentAccounts, payoutDestinations, mercadoPagoCredentials };
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
      anonymous: true, legalAccepted: true, legalTermsVersion: CURRENT_LEGAL_TERMS_VERSION,
    }, { repository, provider, platformFeeBps: 300 });

    expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({
      legalTermsVersion: CURRENT_LEGAL_TERMS_VERSION,
      legalAcceptedAt: expect.any(String),
    }));
  });

  it("permite crear un tip sin sesión fan", async () => {
    const { repository, provider } = dependencies();
    const result = await createTip({ username: "camila", amountMinor: 2_000, payerName: "Mateo", message: "Prueba ❤️", anonymous: false, ...legalAcceptance }, { repository, provider, platformFeeBps: 300 });

    expect(result).toEqual({ tipId: "tip-1", providerPaymentId: "mock_pay_1", status: "pending", checkout: { kind: "redirect", url: "/pay/mock/mock_pay_1" } });
    expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 2_000, platformFeeMinor: 60, netAmountMinor: 1_940, currency: "USD", payerName: "Mateo" }));
  });

  it("calculates voluntary processing support on the server", async () => {
    const deps = dependencies("mock", null);

    await createTip(
      { username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, coverProcessing: true, ...legalAcceptance },
      { ...deps, platformFeeBps: 0, checkoutFeeBps: 540, checkoutFixedFeeMinor: 30 },
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

  it("cobra en USD con el split code de la creadora en dLocal Go", async () => {
    const deps = dependencies("dlocalgo", "SPLIT-CODE-1");
    vi.mocked(deps.provider.createPayment).mockResolvedValue({
      providerPaymentId: "DP-1", status: "pending",
      checkout: { kind: "redirect", url: "https://checkout.dlocalgo.com/x" }, gatewayFeeMinor: null,
    });

    const result = await createTip({ username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance },
      { ...deps, platformFeeBps: 300 });

    expect(deps.paymentAccounts.findConnected).toHaveBeenCalledWith("creator-1", "dlocalgo");
    expect(deps.provider.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      providerAccountId: "SPLIT-CODE-1", currency: "USD", amountMinor: 2_000,
    }));
    // El país lo resuelve el checkout según el fan, no la cuenta de la creadora.
    expect(vi.mocked(deps.provider.createPayment).mock.calls[0][0]).not.toHaveProperty("providerCountry");
    expect(result.checkout).toEqual({ kind: "redirect", url: "https://checkout.dlocalgo.com/x" });
  });

  it("no crea el tip si la creadora no tiene contrato de split en dLocal Go", async () => {
    const deps = dependencies("dlocalgo", null);

    await expect(createTip({ username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance },
      { ...deps, platformFeeBps: 300 })).rejects.toThrow("dlocalgo_account_not_connected");

    expect(deps.repository.insertTip).not.toHaveBeenCalled();
  });

  it("charges under the connected Whop company", async () => {
    const deps = dependencies("whop", "biz_creator");
    vi.mocked(deps.provider.createPayment).mockResolvedValue({
      providerPaymentId: "ch_1", status: "pending",
      checkout: { kind: "redirect", url: "https://whop.com/checkout/ch_1" }, gatewayFeeMinor: null,
    });

    await createTip({ username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance },
      { ...deps, platformFeeBps: 0 });

    expect(deps.paymentAccounts.findConnected).toHaveBeenCalledWith("creator-1", "whop");
    expect(deps.provider.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      providerAccountId: "biz_creator", amountMinor: 2_000, currency: "USD", platformFeeMinor: 0,
    }));
  });

  it("does not create a tip before Whop is connected", async () => {
    const deps = dependencies("whop", null);

    await expect(createTip({ username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance },
      { ...deps, platformFeeBps: 0 })).rejects.toThrow("whop_account_not_connected");

    expect(deps.repository.insertTip).not.toHaveBeenCalled();
  });

  it("uses the saved PayPal payout destination in platform payout mode", async () => {
    const deps = dependencies("paypal", "creator-paypal@example.com");
    vi.mocked(deps.provider.createPayment).mockResolvedValue({
      providerPaymentId: "PP-1", status: "pending",
      checkout: { kind: "redirect", url: "https://paypal.example/checkout" }, gatewayFeeMinor: null,
    });

    await createTip(
      { username: "camila", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance },
      { ...deps, platformFeeBps: 300, paypalFlow: "platform_payouts", payoutDestinations: deps.payoutDestinations },
    );

    expect(deps.payoutDestinations.findConfigured).toHaveBeenCalledWith("creator-1");
    expect(deps.repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({ provider: "paypal" }));
  });

  it("rechaza una creadora inexistente", async () => {
    const { repository, provider } = dependencies();
    vi.mocked(repository.findCreatorByUsername).mockResolvedValue(null);
    await expect(createTip({ username: "missing", amountMinor: 2_000, payerName: null, message: null, anonymous: true, ...legalAcceptance }, { repository, provider, platformFeeBps: 300 })).rejects.toThrow("creator_not_found");
  });
});
