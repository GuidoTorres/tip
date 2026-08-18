import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentAccountWriter, PayPalAccountWrite } from "./paypal-onboarding";

export type ConnectedPaymentAccount = { id: string; providerMerchantId: string; cardPaymentsEnabled: boolean };

export class SupabasePaymentAccountRepository implements PaymentAccountWriter {
  constructor(private readonly client: SupabaseClient) {}

  async findConnected(creatorId: string, provider: string): Promise<ConnectedPaymentAccount | null> {
    const { data, error } = await this.client.from("payment_accounts").select("id,provider_merchant_id,card_payments_enabled")
      .eq("creator_id", creatorId).eq("provider", provider).eq("status", "connected")
      .eq("onboarding_completed", true).eq("payments_receivable", true).maybeSingle();
    if (error) throw new Error("payment_account_lookup_failed");
    if (!data) return null;
    return { id: data.id as string, providerMerchantId: data.provider_merchant_id as string, cardPaymentsEnabled: Boolean(data.card_payments_enabled) };
  }

  async upsertPayPal(account: PayPalAccountWrite) {
    const { error } = await this.client.from("payment_accounts").upsert({
      creator_id: account.creatorId, provider: "paypal", provider_merchant_id: account.providerMerchantId,
      status: account.status, onboarding_completed: account.onboardingCompleted, email_confirmed: account.emailConfirmed,
      payments_receivable: account.paymentsReceivable, card_payments_enabled: account.cardPaymentsEnabled,
      connected_at: account.onboardingCompleted ? new Date().toISOString() : null,
    }, { onConflict: "creator_id,provider" });
    if (error) throw new Error("payment_account_save_failed");
  }
}
