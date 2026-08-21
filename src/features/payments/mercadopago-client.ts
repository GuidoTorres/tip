import { getMercadoPagoCountryOption, type MercadoPagoCountry, type MercadoPagoRegion } from "./mercadopago-regions";

export type MercadoPagoOAuthToken = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  user_id: number | string;
};

export type MercadoPagoUser = { id: number | string; country_id?: string; site_id?: string; status?: string };

export class MercadoPagoClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async exchangeCode(region: MercadoPagoRegion, input: { code: string; redirectUri: string; codeVerifier: string; state: string; testToken: boolean }) {
    const response = await this.fetchImpl("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: region.clientId,
        client_secret: region.clientSecret,
        code: input.code,
        redirect_uri: input.redirectUri,
        code_verifier: input.codeVerifier,
        state: input.state,
        ...(input.testToken ? { test_token: "true" } : {}),
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: unknown } | null;
      const providerCode = typeof body?.error === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(body.error)
        ? body.error
        : "unknown";
      throw new Error(`mercadopago_oauth_exchange_failed:${response.status}:${providerCode}`);
    }
    const token = await response.json() as Partial<MercadoPagoOAuthToken>;
    if (!token.access_token || token.user_id === undefined) throw new Error("mercadopago_oauth_response_invalid");
    return token as MercadoPagoOAuthToken;
  }

  async getCurrentUser(accessToken: string): Promise<MercadoPagoUser> {
    const response = await this.fetchImpl("https://api.mercadopago.com/users/me", {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("mercadopago_user_lookup_failed");
    const user = await response.json() as Partial<MercadoPagoUser>;
    if (user.id === undefined) throw new Error("mercadopago_user_invalid");
    return user as MercadoPagoUser;
  }

  async refreshToken(region: MercadoPagoRegion, refreshToken: string) {
    const response = await this.fetchImpl("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: region.clientId, client_secret: region.clientSecret, refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("mercadopago_token_refresh_failed");
    const token = await response.json() as Partial<MercadoPagoOAuthToken>;
    if (!token.access_token || token.user_id === undefined) throw new Error("mercadopago_oauth_response_invalid");
    return token as MercadoPagoOAuthToken;
  }
}

export function assertMercadoPagoUserRegion(user: MercadoPagoUser, country: MercadoPagoCountry) {
  const expectedSite = getMercadoPagoCountryOption(country).siteId;
  if (user.country_id && user.country_id !== country) throw new Error("mercadopago_country_mismatch");
  if (user.site_id && user.site_id !== expectedSite) throw new Error("mercadopago_country_mismatch");
}
