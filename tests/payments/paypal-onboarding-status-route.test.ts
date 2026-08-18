import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  findConnected: vi.fn(),
  refreshPayPalOnboarding: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: () => ({}) }));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({ PAYMENT_PROVIDER: "paypal" }),
}));
vi.mock("@/features/payments/paypal-client", () => ({
  PayPalClient: class {},
  payPalConfigFromEnv: () => ({}),
}));
vi.mock("@/features/payments/paypal-onboarding", () => ({
  refreshPayPalOnboarding: mocks.refreshPayPalOnboarding,
}));
vi.mock("@/features/payments/payment-account-repository", () => ({
  SupabasePaymentAccountRepository: class {
    findConnected = mocks.findConnected;
  },
}));

import { GET } from "@/app/api/paypal/onboarding/status/route";

describe("PayPal onboarding status route", () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "creator-1" } } });
    mocks.findConnected.mockReset().mockResolvedValue(null);
    mocks.refreshPayPalOnboarding.mockReset();
  });

  it("uses the stored connected account without calling PayPal again", async () => {
    mocks.findConnected.mockResolvedValue({
      id: "payment-account-1",
      providerMerchantId: "MERCHANT-1",
      cardPaymentsEnabled: true,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "connected", cardPaymentsEnabled: true });
    expect(mocks.refreshPayPalOnboarding).not.toHaveBeenCalled();
  });

  it("reports the seller PayPal already associated even without a callback", async () => {
    mocks.refreshPayPalOnboarding.mockResolvedValue({ status: "connected", cardPaymentsEnabled: true });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "connected", cardPaymentsEnabled: true });
  });

  it("does not expose onboarding status without a creator session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "authentication_required" });
  });
});
