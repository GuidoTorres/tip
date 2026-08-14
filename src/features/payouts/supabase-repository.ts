import type { SupabaseClient } from "@supabase/supabase-js";
import type { Currency } from "@/features/payments/types";
import type { PayoutProviderEvent, PayoutRepository } from "./service";

export class SupabasePayoutRepository implements PayoutRepository {
  constructor(private readonly userClient: SupabaseClient, private readonly adminClient: SupabaseClient) {}

  async getAccount(accountId: string, creatorId: string) {
    const { data } = await this.userClient.from("payout_accounts").select("id,creator_id,provider_account_id,provider,status,country,bank_name,last4").eq("id", accountId).eq("creator_id", creatorId).single();
    if (!data) return null;
    return { id: data.id, creatorId: data.creator_id, providerAccountId: data.provider_account_id, provider: data.provider, verified: data.status === "verified", country: data.country, bankName: data.bank_name, last4: data.last4 };
  }

  async getAvailableBalance(creatorId: string, currency: Currency) {
    const { data, error } = await this.userClient.rpc("creator_balances", { requested_creator: creatorId });
    if (error) throw new Error("balance_read_failed");
    const row = (data as Array<{ currency: Currency; available_minor: number }> | null)?.find((item) => item.currency === currency);
    return Number(row?.available_minor ?? 0);
  }

  async reservePayout(input: { creatorId: string; accountId: string; amountMinor: number; currency: Currency; idempotencyKey: string }) {
    const { data, error } = await this.userClient.rpc("request_payout", { p_account_id: input.accountId, p_amount_minor: input.amountMinor, p_currency: input.currency, p_idempotency_key: input.idempotencyKey });
    if (error) throw new Error(error.message.includes("insufficient") ? "insufficient_balance" : "payout_reserve_failed");
    return { id: String(data) };
  }

  async attachProviderPayout(payoutId: string, providerPayoutId: string) {
    const { error } = await this.adminClient.from("payouts").update({ provider_payout_id: providerPayoutId }).eq("id", payoutId);
    if (error) throw new Error("payout_attach_failed");
  }

  async transitionFromProvider(event: PayoutProviderEvent) {
    const { data, error } = await this.adminClient.rpc("transition_payout_from_provider", {
      p_provider: event.provider, p_event_id: event.eventId, p_provider_payout_id: event.providerPayoutId,
      p_payload_digest: event.payloadDigest, p_status: event.status, p_failure_code: event.failureCode ?? null,
    }).single();
    if (error) throw new Error("payout_transition_failed");
    const result = data as { newly_processed: boolean; creator_id: string | null; payout_id: string | null };
    if (!result.newly_processed || !result.payout_id) return { newlyProcessed: false };
    const { data: payout } = await this.adminClient.from("payouts").select("amount_minor,currency,status").eq("id", result.payout_id).single();
    return { newlyProcessed: true, creatorId: result.creator_id ?? undefined, payoutId: result.payout_id, amountMinor: Number(payout?.amount_minor ?? 0), currency: payout?.currency as Currency, status: payout?.status };
  }
}

