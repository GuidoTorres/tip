import type { SupabaseClient } from "@supabase/supabase-js";
import type { Currency } from "@/features/payments/types";
import { validateUsername } from "./username";

// Pending review is not an activation requirement. Explicit moderation still applies.
export async function findPublicCreator(client: SupabaseClient, username: string) {
  const normalized = validateUsername(username);
  if (!normalized.ok) return null;
  // Older databases have no review columns. Read the row on the server and
  // explicitly project public fields; never return the private profile record.
  const { data, error } = await client.from("profiles").select("*")
    .eq("username", normalized.value).eq("onboarding_completed", true).maybeSingle();
  if (error) throw new Error("creator_lookup_failed");
  if (!data || data.onboarding_completed !== true) return null;
  const review = data.payment_review_status;
  const allowed = review == null || review === "pending" || review === "approved";
  return {
    id: data.id as string,
    public_name: data.public_name as string | null,
    username: data.username as string,
    avatar_url: data.avatar_url as string | null,
    bio: data.bio as string | null,
    social_url: (data.social_url ?? null) as string | null,
    preferred_currency: data.preferred_currency as Currency,
    can_accept_tips: allowed,
  };
}
