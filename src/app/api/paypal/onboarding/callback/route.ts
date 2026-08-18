import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";
import { getPublicEnv } from "@/lib/env/public";
import { verifyOAuthState } from "@/lib/security/oauth-state";
import { PayPalClient, payPalConfigFromEnv } from "@/features/payments/paypal-client";
import { completePayPalOnboarding } from "@/features/payments/paypal-onboarding";
import { SupabasePaymentAccountRepository } from "@/features/payments/payment-account-repository";

export async function GET(request: NextRequest) {
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", appUrl));
  const env = getServerEnv();
  const params = new URL(request.url).searchParams;
  const state = params.get("state") ?? "";
  const expectedState = request.cookies.get("tipme_paypal_state")?.value ?? "";
  const merchantId = params.get("merchantIdInPayPal") ?? "";
  const finish = (path: string) => {
    const response = NextResponse.redirect(new URL(path, appUrl));
    response.cookies.delete("tipme_paypal_state");
    return response;
  };
  if (env.PAYMENT_PROVIDER !== "paypal" || !merchantId || !verifyOAuthState(expectedState, state)) {
    return finish("/onboarding?step=2&error=paypal_invalid&paypal=invalid");
  }
  try {
    const result = await completePayPalOnboarding({ creatorId: user.id, merchantId }, {
      client: new PayPalClient(payPalConfigFromEnv(env)),
      repository: new SupabasePaymentAccountRepository(createAdminSupabaseClient()),
    });
    return finish(result.status === "connected" ? "/onboarding?step=2&paypal=connected" : "/onboarding?step=2&error=paypal_restricted&paypal=restricted");
  } catch {
    return finish("/onboarding?step=2&error=paypal_unavailable&paypal=unavailable");
  }
}
