import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServerEnv } from "@/lib/env/server";
import { MercadoPagoClient } from "./mercadopago-client";
import { SupabaseMercadoPagoCredentialRepository } from "./mercadopago-credential-repository";
import { getMercadoPagoRegion, type MercadoPagoCountry } from "./mercadopago-regions";

export class MercadoPagoCredentialManager {
  private readonly repository: SupabaseMercadoPagoCredentialRepository;
  private readonly client: MercadoPagoClient;
  constructor(supabase: SupabaseClient, private readonly env: ServerEnv, fetchImpl?: typeof fetch) {
    this.repository = new SupabaseMercadoPagoCredentialRepository(supabase, env.PAYMENT_TOKEN_ENCRYPTION_KEY);
    this.client = new MercadoPagoClient(fetchImpl);
  }

  async findByAccountId(accountId: string, country?: string) {
    const credentials = await this.repository.findByAccountId(accountId);
    if (!credentials) return null;
    const stillValid = !credentials.expiresAt || new Date(credentials.expiresAt).getTime() > Date.now() + 5 * 60_000;
    if (stillValid) return credentials;
    if (!credentials.refreshToken || (country !== "MX" && country !== "CO")) throw new Error("mercadopago_reauthorization_required");
    const token = await this.client.refreshToken(getMercadoPagoRegion(country as MercadoPagoCountry, this.env), credentials.refreshToken);
    const refreshed = {
      accountId,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? credentials.refreshToken,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
      scopes: token.scope?.split(/\s+/).filter(Boolean) ?? credentials.scopes,
    };
    await this.repository.upsert(refreshed);
    return refreshed;
  }
}
