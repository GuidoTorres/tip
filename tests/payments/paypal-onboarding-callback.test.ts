import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  completePayPalOnboarding: vi.fn(),
  getUser: vi.fn(),
  verifyOAuthState: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: () => ({}) }));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({ PAYMENT_PROVIDER: "paypal" }),
}));
vi.mock("@/lib/env/public", () => ({
  getPublicEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://tipme.pro" }),
}));
vi.mock("@/lib/security/oauth-state", () => ({ verifyOAuthState: mocks.verifyOAuthState }));
vi.mock("@/features/payments/paypal-client", () => ({
  PayPalClient: class {},
  payPalConfigFromEnv: () => ({}),
}));
vi.mock("@/features/payments/paypal-onboarding", () => ({
  completePayPalOnboarding: mocks.completePayPalOnboarding,
}));
vi.mock("@/features/payments/payment-account-repository", () => ({
  SupabasePaymentAccountRepository: class {},
}));

import { GET } from "@/app/api/paypal/onboarding/callback/route";

describe("PayPal onboarding callback", () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "creator-1" } } });
    mocks.completePayPalOnboarding.mockResolvedValue({ status: "connected", cardPaymentsEnabled: true });
    mocks.verifyOAuthState.mockReturnValue(true);
  });

  it("returns to the PayPal connection step so the temporary window can report success", async () => {
    const request = new NextRequest("https://tipme.pro/api/paypal/onboarding/callback?state=valid&merchantIdInPayPal=MERCHANT-1", {
      headers: { cookie: "tipme_paypal_state=valid" },
    });

    const response = await GET(request);

    expect(response.headers.get("location")).toBe("https://tipme.pro/onboarding?step=2&paypal=connected");
  });

  it("returns a restricted result to the parent TipMe window", async () => {
    mocks.completePayPalOnboarding.mockResolvedValue({ status: "restricted", cardPaymentsEnabled: false });
    const request = new NextRequest("https://tipme.pro/api/paypal/onboarding/callback?state=valid&merchantIdInPayPal=MERCHANT-1", {
      headers: { cookie: "tipme_paypal_state=valid" },
    });

    const response = await GET(request);

    expect(response.headers.get("location")).toBe("https://tipme.pro/onboarding?step=2&error=paypal_restricted&paypal=restricted");
  });

  it("returns an unavailable result when PayPal verification fails", async () => {
    mocks.completePayPalOnboarding.mockRejectedValue(new Error("paypal_api_failed"));
    const request = new NextRequest("https://tipme.pro/api/paypal/onboarding/callback?state=valid&merchantIdInPayPal=MERCHANT-1", {
      headers: { cookie: "tipme_paypal_state=valid" },
    });

    const response = await GET(request);

    expect(response.headers.get("location")).toBe("https://tipme.pro/onboarding?step=2&error=paypal_unavailable&paypal=unavailable");
  });

  it("returns an invalid result when the callback state is not authentic", async () => {
    mocks.verifyOAuthState.mockReturnValue(false);
    const request = new NextRequest("https://tipme.pro/api/paypal/onboarding/callback?state=forged&merchantIdInPayPal=MERCHANT-1", {
      headers: { cookie: "tipme_paypal_state=valid" },
    });

    const response = await GET(request);

    expect(response.headers.get("location")).toBe("https://tipme.pro/onboarding?step=2&error=paypal_invalid&paypal=invalid");
  });
});
