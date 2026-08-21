import { describe, expect, it, vi } from "vitest";
import { createMercadoPagoPkce, createMercadoPagoAuthorizationUrl } from "@/features/payments/mercadopago-oauth";
import { getMercadoPagoRegion } from "@/features/payments/mercadopago-regions";
import { MercadoPagoClient } from "@/features/payments/mercadopago-client";

const env = {
  MERCADOPAGO_MX_CLIENT_ID: "mx-client", MERCADOPAGO_MX_CLIENT_SECRET: "mx-secret",
  NEXT_PUBLIC_MERCADOPAGO_MX_PUBLIC_KEY: "mx-public", MERCADOPAGO_MX_WEBHOOK_SECRET: "mx-webhook",
  MERCADOPAGO_CO_CLIENT_ID: "co-client", MERCADOPAGO_CO_CLIENT_SECRET: "co-secret",
  NEXT_PUBLIC_MERCADOPAGO_CO_PUBLIC_KEY: "co-public", MERCADOPAGO_CO_WEBHOOK_SECRET: "co-webhook",
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
});
