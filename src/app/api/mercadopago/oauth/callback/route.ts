import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import { verifyOAuthState } from "@/lib/security/oauth-state";
import { getMercadoPagoRegion, isMercadoPagoCountry } from "@/features/payments/mercadopago-regions";
import { assertMercadoPagoUserRegion, MercadoPagoClient } from "@/features/payments/mercadopago-client";
import { SupabasePaymentAccountRepository } from "@/features/payments/payment-account-repository";
import { SupabaseMercadoPagoCredentialRepository } from "@/features/payments/mercadopago-credential-repository";

export async function GET(request: NextRequest) {
  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const finish = (path: string) => {
    const response = NextResponse.redirect(new URL(path, appUrl));
    response.cookies.delete("tipme_mp_state");
    response.cookies.delete("tipme_mp_verifier");
    response.cookies.delete("tipme_mp_country");
    return response;
  };
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return finish("/login");
  const env = getServerEnv();
  const params = request.nextUrl.searchParams;
  const country = request.cookies.get("tipme_mp_country")?.value ?? "";
  const expectedState = request.cookies.get("tipme_mp_state")?.value ?? "";
  const verifier = request.cookies.get("tipme_mp_verifier")?.value ?? "";
  const code = params.get("code") ?? "";
  if (env.PAYMENT_PROVIDER !== "mercadopago" || !isMercadoPagoCountry(country) || !code || verifier.length < 43 || !verifyOAuthState(expectedState, params.get("state") ?? "")) {
    return finish("/onboarding?step=2&error=mercadopago_invalid");
  }
  try {
    const region = getMercadoPagoRegion(country, env);
    const client = new MercadoPagoClient();
    const redirectUri = new URL("/api/mercadopago/oauth/callback", appUrl).toString();
    const token = await client.exchangeCode(region, {
      code, redirectUri, codeVerifier: verifier, state: params.get("state") ?? "",
      testToken: env.MERCADOPAGO_ENVIRONMENT === "sandbox",
    });
    const mpUser = await client.getCurrentUser(token.access_token);
    assertMercadoPagoUserRegion(mpUser, country);
    if (String(mpUser.id) !== String(token.user_id)) throw new Error("mercadopago_user_mismatch");
    const admin = createAdminSupabaseClient();
    const accounts = new SupabasePaymentAccountRepository(admin);
    const account = await accounts.upsertMercadoPago({ creatorId: user.id, providerMerchantId: String(mpUser.id), country, currency: region.currency });
    const credentials = new SupabaseMercadoPagoCredentialRepository(admin, env.PAYMENT_TOKEN_ENCRYPTION_KEY);
    await credentials.upsert({
      accountId: account.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
      scopes: token.scope?.split(/\s+/).filter(Boolean) ?? [],
    });
    await accounts.markMercadoPagoConnected(account.id);
    return finish("/onboarding?step=2&mercadopago=connected");
  } catch (error) {
    console.error(JSON.stringify({ event: "mercadopago_oauth_error", code: error instanceof Error ? error.message : "unknown" }));
    return finish("/onboarding?step=2&error=mercadopago_unavailable");
  }
}
