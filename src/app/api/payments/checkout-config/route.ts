import { NextResponse } from "next/server";
import { prepareCheckout } from "@/features/payments/prepare-checkout";
import { getPaymentProviderFromEnv } from "@/features/payments/provider-factory";
import { SupabasePaymentAccountRepository } from "@/features/payments/payment-account-repository";
import { SupabaseTipRepository } from "@/features/payments/supabase-tip-repository";
import { SupabasePayoutDestinationRepository } from "@/features/payouts/destination-repository";
import { validateUsername } from "@/features/profiles/username";
import { getServerEnv } from "@/lib/env/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`checkout-config:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const requestedUsername = new URL(request.url).searchParams.get("username") ?? "";
  const username = validateUsername(requestedUsername);
  if (!username.ok) return NextResponse.json({ error: "invalid_username" }, { status: 400 });

  const env = getServerEnv();
  try {
    const admin = createAdminSupabaseClient();
    const result = await prepareCheckout({ username: username.value }, {
      provider: getPaymentProviderFromEnv(env),
      creators: new SupabaseTipRepository(admin),
      paymentAccounts: new SupabasePaymentAccountRepository(admin),
      payoutDestinations: new SupabasePayoutDestinationRepository(admin),
      paypalFlow: env.PAYPAL_FLOW,
      mercadoPagoEnv: env,
      ...(env.PAYPAL_SANDBOX_SINGLE_MERCHANT ? { providerAccountOverride: env.PAYPAL_PARTNER_MERCHANT_ID } : {}),
    });
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "checkout_unavailable";
    if (["creator_not_found", "paypal_account_not_connected", "mercadopago_account_not_connected"].includes(code)) {
      return NextResponse.json({ error: code }, { status: 404 });
    }
    return NextResponse.json({ error: "checkout_unavailable" }, { status: 503 });
  }
}
