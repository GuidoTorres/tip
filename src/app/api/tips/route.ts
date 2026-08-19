import { NextResponse } from "next/server";
import { createTip } from "@/features/payments/create-tip";
import { getPaymentProviderFromEnv } from "@/features/payments/provider-factory";
import { SupabaseTipRepository } from "@/features/payments/supabase-tip-repository";
import { SupabasePaymentAccountRepository } from "@/features/payments/payment-account-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createReceiptToken } from "@/lib/security/receipt";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`create-tip:${ip}`, 12, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const input = await request.json().catch(() => null);
  const env = getServerEnv();
  try {
    const admin = createAdminSupabaseClient();
    const result = await createTip(input, {
      repository: new SupabaseTipRepository(admin),
      paymentAccounts: new SupabasePaymentAccountRepository(admin),
      provider: getPaymentProviderFromEnv(env),
      platformFeeBps: env.PLATFORM_FEE_BPS,
      ...(env.PAYPAL_SANDBOX_SINGLE_MERCHANT ? { providerAccountOverride: env.PAYPAL_PARTNER_MERCHANT_ID } : {}),
    });
    return NextResponse.json({ ...result, receiptToken: createReceiptToken(result.tipId, env.RECEIPT_SIGNING_SECRET) }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "unknown_error";
    const notFoundErrors = ["creator_not_found", "paypal_account_not_connected"];
    const inputErrors = ["legal_acceptance_required"];
    const publicCode = [...notFoundErrors, ...inputErrors].includes(code) ? code : code.startsWith("[") ? "invalid_tip" : code;
    return NextResponse.json({ error: publicCode }, { status: notFoundErrors.includes(code) ? 404 : inputErrors.includes(code) || code.includes("invalid") || code.startsWith("[") ? 400 : 500 });
  }
}
