import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import { createOAuthState } from "@/lib/security/oauth-state";
import { createMercadoPagoAuthorizationUrl, createMercadoPagoPkce } from "@/features/payments/mercadopago-oauth";
import { getMercadoPagoRegion, isMercadoPagoRegionConfigured } from "@/features/payments/mercadopago-regions";

const inputSchema = z.object({ country: z.enum(["MX", "CO"]) });

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER !== "mercadopago") return NextResponse.json({ error: "mercadopago_unavailable" }, { status: 404 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_country" }, { status: 400 });

  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const redirectUri = new URL("/api/mercadopago/oauth/callback", appUrl).toString();
  const region = getMercadoPagoRegion(parsed.data.country, env);
  if (!isMercadoPagoRegionConfigured(region)) return NextResponse.json({ error: "mercadopago_region_not_configured" }, { status: 503 });
  const state = createOAuthState();
  const pkce = createMercadoPagoPkce();
  const response = NextResponse.json({ actionUrl: createMercadoPagoAuthorizationUrl(region, { redirectUri, state, codeChallenge: pkce.challenge }) });
  const cookieOptions = { httpOnly: true, secure: appUrl.startsWith("https://"), sameSite: "lax" as const, path: "/", maxAge: 10 * 60 };
  response.cookies.set("tipme_mp_state", state, cookieOptions);
  response.cookies.set("tipme_mp_verifier", pkce.verifier, cookieOptions);
  response.cookies.set("tipme_mp_country", parsed.data.country, cookieOptions);
  return response;
}
