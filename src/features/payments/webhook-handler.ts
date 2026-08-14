import { getServerEnv } from "@/lib/env/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendTipPush } from "@/features/notifications/web-push";
import { getPaymentProvider } from "./provider-factory";
import { processPaymentWebhook } from "./process-webhook";
import { SupabaseWebhookRepository } from "./supabase-webhook-repository";

export async function handlePaymentWebhook(rawBody: string, signature: string) {
  const env = getServerEnv();
  const admin = createAdminSupabaseClient();
  const repository = new SupabaseWebhookRepository(admin);
  return processPaymentWebhook(rawBody, signature, {
    provider: getPaymentProvider({ provider: env.PAYMENT_PROVIDER, mockWebhookSecret: env.MOCK_WEBHOOK_SECRET }),
    repository,
    push: async (tip) => {
      const { data } = await admin.from("tips").select("creator_id").eq("id", tip.id).single();
      if (!data?.creator_id) return { sent: 0, revoked: 0, failed: 1 };
      return sendTipPush(admin, data.creator_id, tip);
    },
  });
}

