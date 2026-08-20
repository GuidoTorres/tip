import type { SupabaseClient } from "@supabase/supabase-js";
import type { TipRepository } from "./create-tip";
import type { Currency } from "./types";

export class SupabaseTipRepository implements TipRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findCreatorByUsername(username: string) {
    const { data, error } = await this.client.rpc("get_public_creator", { requested_username: username }).maybeSingle();
    if (error) throw new Error("creator_lookup_failed");
    if (!data) return null;
    const row = data as { id: string; preferred_currency: Currency };
    return { id: row.id, currency: row.preferred_currency };
  }

  async insertTip(tip: Parameters<TipRepository["insertTip"]>[0]) {
    const { data, error } = await this.client.from("tips").insert({
      creator_id: tip.creatorId, payer_name: tip.payerName, message: tip.message, anonymous: tip.anonymous,
      base_amount_minor: tip.baseAmountMinor, processing_support_minor: tip.processingSupportMinor,
      amount_minor: tip.amountMinor, currency: tip.currency, platform_fee_minor: tip.platformFeeMinor,
      gateway_fee_minor: tip.gatewayFeeMinor, net_amount_minor: tip.netAmountMinor, provider: tip.provider, status: "created",
      legal_terms_version: tip.legalTermsVersion, legal_accepted_at: tip.legalAcceptedAt,
    }).select("id").single();
    if (error) throw new Error("tip_create_failed");
    return data as { id: string };
  }

  async attachPayment(tipId: string, payment: Parameters<TipRepository["attachPayment"]>[1]) {
    const { error } = await this.client.from("tips").update({ provider_payment_id: payment.providerPaymentId, status: payment.status }).eq("id", tipId);
    if (error) throw new Error("payment_attach_failed");
  }
}
