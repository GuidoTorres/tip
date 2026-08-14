"use server";

import { redirect } from "next/navigation";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";
import { getPaymentProvider } from "@/features/payments/provider-factory";
import { requestPayout } from "./service";
import { SupabasePayoutRepository } from "./supabase-repository";
import { supportedCurrencies } from "@/features/payments/types";

const schema = z.object({ accountId: z.string().uuid(), amountMinor: z.coerce.number().int().positive(), currency: z.enum(supportedCurrencies) });

export async function requestPayoutAction(formData: FormData) {
  const parsed = schema.safeParse({ accountId: formData.get("accountId"), amountMinor: formData.get("amountMinor"), currency: formData.get("currency") });
  if (!parsed.success) redirect("/dashboard/payouts?error=invalid_amount");
  const userClient = await createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminSupabaseClient();
  const env = getServerEnv();
  const idempotencyKey = createHash("sha256").update(`${user.id}:${parsed.data.accountId}:${parsed.data.amountMinor}:${randomUUID()}`).digest("hex");
  try {
    await requestPayout({ creatorId: user.id, ...parsed.data, idempotencyKey }, {
      repository: new SupabasePayoutRepository(userClient, admin),
      provider: getPaymentProvider({ provider: env.PAYMENT_PROVIDER, mockWebhookSecret: env.MOCK_WEBHOOK_SECRET }),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "payout_failed";
    redirect(`/dashboard/payouts?error=${encodeURIComponent(code)}`);
  }
  redirect("/dashboard/payouts?success=requested");
}

