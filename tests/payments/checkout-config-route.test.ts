import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  allowed: true,
  prepareCheckout: vi.fn(),
}));

vi.mock("@/features/payments/prepare-checkout", () => ({ prepareCheckout: mocks.prepareCheckout }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: () => mocks.allowed }));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({
    PAYMENT_PROVIDER: "paypal",
    PAYPAL_FLOW: "platform_payouts",
    PAYPAL_SANDBOX_SINGLE_MERCHANT: false,
    PAYPAL_PARTNER_MERCHANT_ID: "PARTNER-MERCHANT",
    PAYPAL_CLIENT_SECRET: "must-never-leak",
    SUPABASE_SERVICE_ROLE_KEY: "must-never-leak",
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: () => ({}) }));
vi.mock("@/features/payments/provider-factory", () => ({ getPaymentProviderFromEnv: () => ({ name: "paypal" }) }));
vi.mock("@/features/payments/supabase-tip-repository", () => ({ SupabaseTipRepository: class {} }));
vi.mock("@/features/payments/payment-account-repository", () => ({ SupabasePaymentAccountRepository: class {} }));

import { GET } from "@/app/api/payments/checkout-config/route";

describe("checkout configuration route", () => {
  beforeEach(() => {
    mocks.allowed = true;
    mocks.prepareCheckout.mockReset().mockResolvedValue({
      kind: "mercadopago",
      publicKey: "public-key", country: "PE", currency: "PEN",
    });
  });

  it("returns only the temporary browser configuration", async () => {
    const response = await GET(new Request("https://tipme.pro/api/payments/checkout-config?username=camila"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      kind: "mercadopago",
      publicKey: "public-key", country: "PE", currency: "PEN",
    });
    expect(JSON.stringify(body)).not.toContain("must-never-leak");
  });

  it("preserves redirect mode for the mock provider", async () => {
    mocks.prepareCheckout.mockResolvedValue({ kind: "redirect" });

    const response = await GET(new Request("https://tipme.pro/api/payments/checkout-config?username=camila"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ kind: "redirect" });
  });

  it("rejects an invalid username before preparing PayPal", async () => {
    const response = await GET(new Request("https://tipme.pro/api/payments/checkout-config?username=x"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_username" });
    expect(mocks.prepareCheckout).not.toHaveBeenCalled();
  });

  it("rate limits repeated public preparation", async () => {
    mocks.allowed = false;

    const response = await GET(new Request("https://tipme.pro/api/payments/checkout-config?username=camila"));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "rate_limited" });
    expect(mocks.prepareCheckout).not.toHaveBeenCalled();
  });
});
