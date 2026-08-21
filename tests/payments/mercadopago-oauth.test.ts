import { describe, expect, it, vi } from "vitest";
import { createMercadoPagoPkce, createMercadoPagoAuthorizationUrl } from "@/features/payments/mercadopago-oauth";
import { getMercadoPagoRegion } from "@/features/payments/mercadopago-regions";
import { assertMercadoPagoSellerToken, assertMercadoPagoUserRegion, MercadoPagoClient } from "@/features/payments/mercadopago-client";

const env = {
  MERCADOPAGO_AR_CLIENT_ID: "ar-client", MERCADOPAGO_AR_CLIENT_SECRET: "ar-secret",
  NEXT_PUBLIC_MERCADOPAGO_AR_PUBLIC_KEY: "ar-public", MERCADOPAGO_AR_WEBHOOK_SECRET: "ar-webhook",
  MERCADOPAGO_BR_CLIENT_ID: "br-client", MERCADOPAGO_BR_CLIENT_SECRET: "br-secret",
  NEXT_PUBLIC_MERCADOPAGO_BR_PUBLIC_KEY: "br-public", MERCADOPAGO_BR_WEBHOOK_SECRET: "br-webhook",
  MERCADOPAGO_CL_CLIENT_ID: "cl-client", MERCADOPAGO_CL_CLIENT_SECRET: "cl-secret",
  NEXT_PUBLIC_MERCADOPAGO_CL_PUBLIC_KEY: "cl-public", MERCADOPAGO_CL_WEBHOOK_SECRET: "cl-webhook",
  MERCADOPAGO_MX_CLIENT_ID: "mx-client", MERCADOPAGO_MX_CLIENT_SECRET: "mx-secret",
  NEXT_PUBLIC_MERCADOPAGO_MX_PUBLIC_KEY: "mx-public", MERCADOPAGO_MX_WEBHOOK_SECRET: "mx-webhook",
  MERCADOPAGO_CO_CLIENT_ID: "co-client", MERCADOPAGO_CO_CLIENT_SECRET: "co-secret",
  NEXT_PUBLIC_MERCADOPAGO_CO_PUBLIC_KEY: "co-public", MERCADOPAGO_CO_WEBHOOK_SECRET: "co-webhook",
  MERCADOPAGO_PE_CLIENT_ID: "pe-client", MERCADOPAGO_PE_CLIENT_SECRET: "pe-secret",
  NEXT_PUBLIC_MERCADOPAGO_PE_PUBLIC_KEY: "pe-public", MERCADOPAGO_PE_WEBHOOK_SECRET: "pe-webhook",
  MERCADOPAGO_UY_CLIENT_ID: "uy-client", MERCADOPAGO_UY_CLIENT_SECRET: "uy-secret",
  NEXT_PUBLIC_MERCADOPAGO_UY_PUBLIC_KEY: "uy-public", MERCADOPAGO_UY_WEBHOOK_SECRET: "uy-webhook",
};

describe("Mercado Pago OAuth", () => {
  it("creates an S256 PKCE pair", () => {
    const pkce = createMercadoPagoPkce();
    expect(pkce.verifier.length).toBeGreaterThanOrEqual(43);
    expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(pkce.challenge).not.toBe(pkce.verifier);
  });

  it("builds a regional authorization URL without exposing the secret", () => {
    const region = getMercadoPagoRegion("MX", env);
    const url = new URL(createMercadoPagoAuthorizationUrl(region, {
      redirectUri: "https://tipme.pro/api/mercadopago/oauth/callback",
      state: "state-value", codeChallenge: "challenge-value",
    }));
    expect(url.origin).toBe("https://auth.mercadopago.com.mx");
    expect(url.searchParams.get("client_id")).toBe("mx-client");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("platform_id")).toBe("mp");
    expect(url.toString()).not.toContain("mx-secret");
  });

  it("requests an OAuth test token with state while running in Sandbox", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "TEST-token", user_id: 42 }), { status: 200 }));
    const client = new MercadoPagoClient(fetchImpl);
    const input = { code: "auth-code", redirectUri: "https://local.example/callback", codeVerifier: "v".repeat(43), state: "state-value", testToken: true };

    await client.exchangeCode(getMercadoPagoRegion("MX", env), input);

    const [, options] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(String(options.body));
    expect(body.get("state")).toBe("state-value");
    expect(body.get("test_token")).toBe("true");
  });

  it("reports a safe provider error code when the token exchange fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
    const client = new MercadoPagoClient(fetchImpl);

    await expect(client.exchangeCode(getMercadoPagoRegion("PE", env), {
      code: "auth-code", redirectUri: "https://tipme.pro/api/mercadopago/oauth/callback",
      codeVerifier: "v".repeat(43), state: "state-value", testToken: false,
    })).rejects.toThrow("mercadopago_oauth_exchange_failed:400:invalid_grant");
  });

  it("accepts a Peruvian account only for the Peru regional connection", () => {
    expect(() => assertMercadoPagoUserRegion({ id: 42, country_id: "PE", site_id: "MPE" }, "PE")).not.toThrow();
    expect(() => assertMercadoPagoUserRegion({ id: 42, country_id: "PE", site_id: "MPE" }, "MX")).toThrow("mercadopago_country_mismatch");
  });

  it("requires a renewable seller token with payment write permissions", () => {
    expect(() => assertMercadoPagoSellerToken({ access_token: "token", refresh_token: "refresh", user_id: 42, scope: "offline_access payments write" })).not.toThrow();
    expect(() => assertMercadoPagoSellerToken({ access_token: "token", user_id: 42, scope: "payments write" })).toThrow("mercadopago_seller_account_required");
    expect(() => assertMercadoPagoSellerToken({ access_token: "token", refresh_token: "refresh", user_id: 42, scope: "read" })).toThrow("mercadopago_seller_account_required");
  });
});
