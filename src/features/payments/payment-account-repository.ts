import type { SupabaseClient } from "@supabase/supabase-js";

import type { Currency } from "./types";
import type { MercadoPagoCountry, MercadoPagoCurrency } from "./mercadopago-regions";

export type ConnectedPaymentAccount = {
  id: string;
  providerMerchantId: string;
  cardPaymentsEnabled: boolean;
  country: MercadoPagoCountry | null;
  currency: Currency | null;
};

export class SupabasePaymentAccountRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findConnected(creatorId: string, provider: string): Promise<ConnectedPaymentAccount | null> {
    const { data, error } = await this.client.from("payment_accounts").select("id,provider_merchant_id,card_payments_enabled,provider_country,provider_currency")
      .eq("creator_id", creatorId).eq("provider", provider).eq("status", "connected")
      .eq("onboarding_completed", true).eq("payments_receivable", true).maybeSingle();
    if (error) throw new Error("payment_account_lookup_failed");
    if (!data) return null;
    return {
      id: data.id as string,
      providerMerchantId: data.provider_merchant_id as string,
      cardPaymentsEnabled: Boolean(data.card_payments_enabled),
      country: data.provider_country as MercadoPagoCountry | null,
      currency: data.provider_currency as Currency | null,
    };
  }

  async upsertMercadoPago(account: { creatorId: string; providerMerchantId: string; country: MercadoPagoCountry; currency: MercadoPagoCurrency }) {
    const { data, error } = await this.client.from("payment_accounts").upsert({
      creator_id: account.creatorId,
      provider: "mercadopago",
      provider_merchant_id: account.providerMerchantId,
      provider_country: account.country,
      provider_currency: account.currency,
      status: "pending",
      onboarding_completed: false,
      email_confirmed: true,
      payments_receivable: false,
      card_payments_enabled: false,
      connected_at: null,
    }, { onConflict: "creator_id,provider" }).select("id").single();
    if (error || !data) throw new Error("payment_account_save_failed");
    return { id: data.id as string };
  }

  async markMercadoPagoConnected(accountId: string) {
    const { error } = await this.client.from("payment_accounts").update({
      status: "connected", onboarding_completed: true, payments_receivable: true,
      card_payments_enabled: true, connected_at: new Date().toISOString(),
    }).eq("id", accountId).eq("provider", "mercadopago");
    if (error) throw new Error("payment_account_save_failed");
  }
}
