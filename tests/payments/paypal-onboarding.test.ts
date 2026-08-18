import { describe, expect, it, vi } from "vitest";
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
    };
    const repository: PaymentAccountWriter = { upsertPayPal: vi.fn().mockResolvedValue(undefined) };
    await expect(completePayPalOnboarding({ creatorId: "creator-1", merchantId: "MERCHANT-1" }, { client, repository })).resolves.toEqual({ status: "restricted", cardPaymentsEnabled: false });
  });

  it("creates a PayPal-hosted onboarding URL with payment and fee permissions", async () => {
    const client: PayPalOnboardingClient = {
      createPartnerReferral: vi.fn().mockResolvedValue({ links: [{ rel: "action_url", href: "https://paypal.test/onboard" }] }),
      getMerchantIntegration: vi.fn(),
    };
    const url = await startPayPalOnboarding({ creatorId: "creator-1", returnUrl: "https://tipme.pro/api/paypal/onboarding/callback?state=signed" }, client);
    expect(url).toBe("https://paypal.test/onboard");
    expect(client.createPartnerReferral).toHaveBeenCalledWith(expect.objectContaining({ tracking_id: "creator-1", products: ["PPCP"] }));
    expect(JSON.stringify(vi.mocked(client.createPartnerReferral).mock.calls[0][0])).toContain("PARTNER_FEE");
  });
});
