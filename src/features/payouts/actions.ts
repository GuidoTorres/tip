"use server";

import { redirect } from "next/navigation";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";
import { getPaymentProviderFromEnv } from "@/features/payments/provider-factory";
import { requestPayout } from "./service";
import { SupabasePayoutRepository } from "./supabase-repository";
import { APPLICATION_CURRENCY } from "@/features/payments/application-currency";

const schema = z.object({ accountId: z.string().uuid(), amountMinor: z.coerce.number().int().positive(), currency: z.literal(APPLICATION_CURRENCY) });

export async function requestPayoutAction(formData: FormData) {
  const parsed = schema.safeParse({ accountId: formData.get("accountId"), amountMinor: formData.get("amountMinor"), currency: formData.get("currency") });
  if (!parsed.success) redirect("/dashboard/payouts?error=invalid_amount");
  const userClient = await createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminSupabaseClient();
  const env = getServerEnv();
  const platformPayouts = env.PAYMENT_PROVIDER === "paypal" && env.PAYPAL_FLOW === "platform_payouts";
  if (env.PAYMENT_PROVIDER !== "mock" && !platformPayouts) redirect("/dashboard/payouts?error=managed_by_provider");
  const idempotencyKey = createHash("sha256").update(`${user.id}:${parsed.data.accountId}:${parsed.data.amountMinor}:${randomUUID()}`).digest("hex");
  try {
    await requestPayout({ creatorId: user.id, ...parsed.data, idempotencyKey }, {
      repository: new SupabasePayoutRepository(userClient, admin),
      provider: getPaymentProviderFromEnv(env),
      platformPayouts,
      payoutFeeBps: platformPayouts ? env.PAYPAL_PAYOUT_FEE_BPS : 0,
      payoutFeeCapMinor: platformPayouts ? env.PAYPAL_PAYOUT_FEE_CAP_MINOR : 0,
      ...(platformPayouts && env.PAYPAL_ENVIRONMENT === "sandbox" && env.PAYPAL_SANDBOX_PAYOUT_RECIPIENT_ID
        ? { payoutRecipientOverride: { recipientType: "PAYPAL_ID" as const, receiver: env.PAYPAL_SANDBOX_PAYOUT_RECIPIENT_ID } }
        : {}),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "payout_failed";
    redirect(`/dashboard/payouts?error=${encodeURIComponent(code)}`);
  }
  redirect("/dashboard/payouts?success=requested");
}
