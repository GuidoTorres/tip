import type { SupabaseClient } from "@supabase/supabase-js";
import type { PayoutDestinationLookup } from "@/features/payments/create-tip";

export class SupabasePayoutDestinationRepository implements PayoutDestinationLookup {
  constructor(private readonly client: SupabaseClient) {}

  async findConfigured(creatorId: string) {
    const { data, error } = await this.client
      .from("payout_accounts")
      .select("id,status")
      .eq("creator_id", creatorId)
      .eq("provider", "paypal")
      .in("status", ["pending", "verified"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error("payout_destination_lookup_failed");
    if (!data) return null;
    return data as { id: string; status: "pending" | "verified" };
  }
}
