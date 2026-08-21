import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptPaymentToken, encryptPaymentToken } from "@/lib/security/token-encryption";

export type MercadoPagoCredentials = {
  accountId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopes: string[];
};

export class SupabaseMercadoPagoCredentialRepository {
  constructor(private readonly client: SupabaseClient, private readonly encryptionKey: string) {}

  async upsert(credentials: MercadoPagoCredentials) {
    const { error } = await this.client.from("payment_account_credentials").upsert({
      payment_account_id: credentials.accountId,
      access_token_ciphertext: encryptPaymentToken(credentials.accessToken, this.encryptionKey),
      refresh_token_ciphertext: credentials.refreshToken ? encryptPaymentToken(credentials.refreshToken, this.encryptionKey) : null,
      expires_at: credentials.expiresAt,
      scopes: credentials.scopes,
    }, { onConflict: "payment_account_id" });
    if (error) throw new Error("mercadopago_credentials_save_failed");
  }

  async findByAccountId(accountId: string): Promise<MercadoPagoCredentials | null> {
    const { data, error } = await this.client.from("payment_account_credentials")
      .select("payment_account_id,access_token_ciphertext,refresh_token_ciphertext,expires_at,scopes")
      .eq("payment_account_id", accountId).maybeSingle();
    if (error) throw new Error("mercadopago_credentials_lookup_failed");
    if (!data) return null;
    return {
      accountId: data.payment_account_id as string,
      accessToken: decryptPaymentToken(data.access_token_ciphertext as string, this.encryptionKey),
      refreshToken: data.refresh_token_ciphertext ? decryptPaymentToken(data.refresh_token_ciphertext as string, this.encryptionKey) : null,
      expiresAt: data.expires_at as string | null,
      scopes: (data.scopes as string[] | null) ?? [],
    };
  }
}
