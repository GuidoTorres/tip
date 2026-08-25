import { getServerEnv } from "@/lib/env/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendTipPush } from "@/features/notifications/web-push";
import { getPaymentProviderFromEnv } from "./provider-factory";
import { processPaymentWebhook } from "./process-webhook";
import { SupabaseWebhookRepository } from "./supabase-webhook-repository";

export async function handlePaymentWebhook(rawBody: string, headers: Headers) {
  const env = getServerEnv();
  const admin = createAdminSupabaseClient();
  const repository = new SupabaseWebhookRepository(admin, env.PAYMENT_PROVIDER);
  return processPaymentWebhook(rawBody, headers, {
    provider: getPaymentProviderFromEnv(env),
    repository,
    push: async (tip) => {
      const { data } = await admin.from("tips").select("creator_id").eq("id", tip.id).single();
      if (!data?.creator_id) return { sent: 0, revoked: 0, failed: 1 };
      return sendTipPush(admin, data.creator_id, tip);
    },
  });
}
