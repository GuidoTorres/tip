import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createOAuthState: vi.fn(),
  startPayPalOnboarding: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({ PAYMENT_PROVIDER: "paypal" }),
}));
vi.mock("@/lib/env/public", () => ({
  getPublicEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://tipme.pro" }),
}));
vi.mock("@/lib/security/oauth-state", () => ({ createOAuthState: mocks.createOAuthState }));
vi.mock("@/features/payments/paypal-client", () => ({
  PayPalClient: class {},
  payPalConfigFromEnv: () => ({}),
}));
vi.mock("@/features/payments/paypal-onboarding", () => ({
  startPayPalOnboarding: mocks.startPayPalOnboarding,
}));

import { POST } from "@/app/api/paypal/onboarding/route";

describe("PayPal onboarding start route", () => {
  it("returns a one-use URL configured for PayPal's official mini-browser", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "creator-1" } } });
    mocks.createOAuthState.mockReturnValue("secure-state");
    mocks.startPayPalOnboarding.mockResolvedValue("https://www.sandbox.paypal.com/onboard?token=one-use");

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      actionUrl: "https://www.sandbox.paypal.com/onboard?token=one-use&displayMode=minibrowser",
    });
    expect(response.headers.get("set-cookie")).toContain("tipme_paypal_state=secure-state");
  });
});
