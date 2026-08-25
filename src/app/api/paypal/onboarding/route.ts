import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env/server";
import { getPublicEnv } from "@/lib/env/public";
import { createOAuthState } from "@/lib/security/oauth-state";
import { PayPalClient, payPalConfigFromEnv } from "@/features/payments/paypal-client";
import { startPayPalOnboarding } from "@/features/payments/paypal-onboarding";

export async function POST() {
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER !== "paypal") return NextResponse.json({ error: "paypal_unavailable" }, { status: 404 });
  const state = createOAuthState();
  const callback = new URL("/api/paypal/onboarding/callback", appUrl);
  callback.searchParams.set("state", state);
  try {
    const url = await startPayPalOnboarding({ creatorId: user.id, returnUrl: callback.toString() }, new PayPalClient(payPalConfigFromEnv(env)));
    const response = NextResponse.json({ actionUrl: url });
    response.cookies.set("tipme_paypal_state", state, {
      httpOnly: true,
      secure: appUrl.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "paypal_unavailable" }, { status: 503 });
  }
}
