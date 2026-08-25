import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";
import { PayPalClient, payPalConfigFromEnv } from "@/features/payments/paypal-client";
import { refreshPayPalOnboarding } from "@/features/payments/paypal-onboarding";
import { SupabasePaymentAccountRepository } from "@/features/payments/payment-account-repository";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER !== "paypal") return NextResponse.json({ error: "paypal_unavailable" }, { status: 404 });

  try {
    const repository = new SupabasePaymentAccountRepository(createAdminSupabaseClient());
    const storedAccount = await repository.findConnected(user.id, "paypal");
    if (storedAccount) {
      return NextResponse.json({
        status: "connected",
        cardPaymentsEnabled: storedAccount.cardPaymentsEnabled,
      }, { headers: { "cache-control": "no-store" } });
    }

    const result = await refreshPayPalOnboarding({ creatorId: user.id }, {
      client: new PayPalClient(payPalConfigFromEnv(env)),
      repository,
    });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "paypal_unavailable" }, { status: 503 });
  }
}
