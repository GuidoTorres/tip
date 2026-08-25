import { describe, expect, it, vi } from "vitest";
import * as onboardingModule from "@/features/payments/paypal-onboarding";
import { completePayPalOnboarding, startPayPalOnboarding, type PaymentAccountWriter, type PayPalOnboardingClient } from "@/features/payments/paypal-onboarding";

describe("PayPal creator onboarding", () => {
  it("uses the verified merchant integration instead of callback claims", async () => {
    const client: PayPalOnboardingClient = {
      createPartnerReferral: vi.fn(),
      getMerchantIntegration: vi.fn().mockResolvedValue({
        merchant_id: "MERCHANT-1",
        payments_receivable: true,
        primary_email_confirmed: true,
        products: [{ name: "PPCP_CUSTOM", vetting_status: "SUBSCRIBED" }],
        capabilities: [{ name: "CUSTOM_CARD_PROCESSING", status: "ACTIVE" }],
        oauth_integrations: [{ oauth_third_party: [{ scopes: ["payments"] }] }],
      }),
      getMerchantIntegrationByTrackingId: vi.fn(),
    };
    const repository: PaymentAccountWriter = { upsertPayPal: vi.fn().mockResolvedValue(undefined) };

    const result = await completePayPalOnboarding({ creatorId: "creator-1", merchantId: "MERCHANT-1" }, { client, repository });

    expect(result).toEqual({ status: "connected", cardPaymentsEnabled: true });
    expect(repository.upsertPayPal).toHaveBeenCalledWith(expect.objectContaining({
      creatorId: "creator-1", providerMerchantId: "MERCHANT-1", status: "connected",
      paymentsReceivable: true, emailConfirmed: true, onboardingCompleted: true, cardPaymentsEnabled: true,
    }));
  });

  it("keeps a merchant restricted when PayPal says payments are not receivable", async () => {
    const client: PayPalOnboardingClient = {
      createPartnerReferral: vi.fn(),
      getMerchantIntegration: vi.fn().mockResolvedValue({ merchant_id: "MERCHANT-1", payments_receivable: false, primary_email_confirmed: true, products: [], capabilities: [], oauth_integrations: [] }),
      getMerchantIntegrationByTrackingId: vi.fn(),
    };
    const repository: PaymentAccountWriter = { upsertPayPal: vi.fn().mockResolvedValue(undefined) };
    await expect(completePayPalOnboarding({ creatorId: "creator-1", merchantId: "MERCHANT-1" }, { client, repository })).resolves.toEqual({ status: "restricted", cardPaymentsEnabled: false });
  });

  it("creates a PayPal-hosted onboarding URL with payment and fee permissions", async () => {
    const client: PayPalOnboardingClient = {
      createPartnerReferral: vi.fn().mockResolvedValue({ links: [{ rel: "action_url", href: "https://paypal.test/onboard" }] }),
      getMerchantIntegration: vi.fn(),
      getMerchantIntegrationByTrackingId: vi.fn(),
    };
    const url = await startPayPalOnboarding({ creatorId: "creator-1", returnUrl: "https://tipme.pro/api/paypal/onboarding/callback?state=signed" }, client);
    expect(url).toBe("https://paypal.test/onboard");
    expect(client.createPartnerReferral).toHaveBeenCalledWith(expect.objectContaining({ tracking_id: "creator-1", products: ["PPCP"] }));
    expect(JSON.stringify(vi.mocked(client.createPartnerReferral).mock.calls[0][0])).toContain("PARTNER_FEE");
  });

  it("discovers and saves a completed seller even when PayPal never calls the return URL", async () => {
    const refreshOnboarding = (onboardingModule as unknown as {
      refreshPayPalOnboarding?: (input: { creatorId: string }, dependencies: { client: unknown; repository: PaymentAccountWriter }) => Promise<unknown>;
    }).refreshPayPalOnboarding;
    expect(refreshOnboarding).toBeTypeOf("function");
    if (!refreshOnboarding) return;
    const client = {
      createPartnerReferral: vi.fn(),
      getMerchantIntegrationByTrackingId: vi.fn().mockResolvedValue({
        merchant_id: "MERCHANT-1",
        tracking_id: "creator-1",
      }),
      getMerchantIntegration: vi.fn().mockResolvedValue({
        merchant_id: "MERCHANT-1",
        payments_receivable: true,
        primary_email_confirmed: true,
        products: [{ name: "PPCP_CUSTOM", vetting_status: "SUBSCRIBED" }],
        capabilities: [{ name: "CUSTOM_CARD_PROCESSING", status: "ACTIVE" }],
        oauth_integrations: [{ oauth_third_party: [{ scopes: ["payments"] }] }],
      }),
    };
    const repository: PaymentAccountWriter = { upsertPayPal: vi.fn().mockResolvedValue(undefined) };

    await expect(refreshOnboarding({ creatorId: "creator-1" }, { client, repository })).resolves.toEqual({
      status: "connected",
      cardPaymentsEnabled: true,
    });
    expect(repository.upsertPayPal).toHaveBeenCalledWith(expect.objectContaining({
      creatorId: "creator-1",
      providerMerchantId: "MERCHANT-1",
      status: "connected",
    }));
  });

  it("keeps waiting while PayPal has not exposed a seller for the tracking ID", async () => {
    const refreshOnboarding = (onboardingModule as unknown as {
      refreshPayPalOnboarding?: (input: { creatorId: string }, dependencies: { client: unknown; repository: PaymentAccountWriter }) => Promise<unknown>;
    }).refreshPayPalOnboarding;
    expect(refreshOnboarding).toBeTypeOf("function");
    if (!refreshOnboarding) return;
    const repository: PaymentAccountWriter = { upsertPayPal: vi.fn().mockResolvedValue(undefined) };
    const client = {
      createPartnerReferral: vi.fn(),
      getMerchantIntegration: vi.fn(),
      getMerchantIntegrationByTrackingId: vi.fn().mockResolvedValue({}),
    };

    await expect(refreshOnboarding({ creatorId: "creator-1" }, { client, repository })).resolves.toEqual({ status: "pending" });
    expect(repository.upsertPayPal).not.toHaveBeenCalled();
  });
});
