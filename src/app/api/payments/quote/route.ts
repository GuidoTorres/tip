import { NextResponse } from "next/server";
import { createMercadoPagoQuote } from "@/features/payments/create-mercadopago-quote";
import { MercadoPagoCredentialManager } from "@/features/payments/mercadopago-credential-manager";
import { getMercadoPagoExchangeRate } from "@/features/payments/mercadopago-exchange-rate";
import { SupabasePaymentAccountRepository } from "@/features/payments/payment-account-repository";
import { SupabaseTipRepository } from "@/features/payments/supabase-tip-repository";
import { getServerEnv } from "@/lib/env/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`payment-quote:${ip}`, 30, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const input = await request.json().catch(() => null);
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER !== "mercadopago") return NextResponse.json({ error: "quote_unavailable" }, { status: 404 });
  try {
    const admin = createAdminSupabaseClient();
    const result = await createMercadoPagoQuote(input, {
      creators: new SupabaseTipRepository(admin),
      paymentAccounts: new SupabasePaymentAccountRepository(admin),
      credentials: new MercadoPagoCredentialManager(admin, env),
      getRate: getMercadoPagoExchangeRate,
      signingSecret: env.RECEIPT_SIGNING_SECRET,
    });
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "quote_unavailable";
    const status = code === "creator_not_found" || code === "mercadopago_account_not_connected" ? 404
      : code.startsWith("[") ? 400 : 503;
    return NextResponse.json({ error: code.startsWith("[") ? "invalid_quote_request" : code }, { status });
  }
}
