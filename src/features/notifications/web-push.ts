import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import { buildTipPushPayload, sendCreatorPush, type PushSender, type PushSubscriptionRow, type TipPushData } from "./push";

function sender(): PushSender {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();
  webpush.setVapidDetails(serverEnv.VAPID_SUBJECT, publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY, serverEnv.VAPID_PRIVATE_KEY);
  return {
    async send(subscription, payload) {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ ...payload, icon: "/icons/icon-192.png", badge: "/icons/badge-96.png" }), { TTL: 60, urgency: "high", topic: payload.tag.slice(0, 32) });
    },
  };
}

export async function sendTipPush(client: SupabaseClient, creatorId: string, tip: TipPushData) {
  const { data, error } = await client.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("creator_id", creatorId).is("revoked_at", null);
  if (error) throw new Error("push_subscriptions_failed");
  const subscriptions = (data ?? []) as PushSubscriptionRow[];
  if (subscriptions.length === 0) return { sent: 0, revoked: 0, failed: 0 };
  return sendCreatorPush(buildTipPushPayload(tip), subscriptions, sender(), {
    revoke: async (id) => { await client.from("push_subscriptions").update({ revoked_at: new Date().toISOString() }).eq("id", id); },
    markUsed: async (id) => { await client.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", id); },
  });
}

export async function sendPayoutPush(client: SupabaseClient, payload: { creatorId: string; payoutId: string; title: string; body: string; status: string; amountMinor?: number; currency?: string }) {
  const { data, error } = await client.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("creator_id", payload.creatorId).is("revoked_at", null);
  if (error) throw new Error("push_subscriptions_failed");
  const subscriptions = (data ?? []) as PushSubscriptionRow[];
  const safePayload = { title: payload.title, body: payload.body, url: "/dashboard/payouts", tag: `payout-${payload.payoutId}-${payload.status}` };
  return sendCreatorPush(safePayload, subscriptions, sender(), {
    revoke: async (id) => { await client.from("push_subscriptions").update({ revoked_at: new Date().toISOString() }).eq("id", id); },
    markUsed: async (id) => { await client.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", id); },
  });
}

