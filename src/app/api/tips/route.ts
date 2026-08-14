import { NextResponse } from "next/server";
import { createTip } from "@/features/payments/create-tip";
import { getPaymentProvider } from "@/features/payments/provider-factory";
import { SupabaseTipRepository } from "@/features/payments/supabase-tip-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`create-tip:${ip}`, 12, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const input = await request.json().catch(() => null);
  const env = getServerEnv();
  try {
    const result = await createTip(input, {
      repository: new SupabaseTipRepository(createAdminSupabaseClient()),
      provider: getPaymentProvider({ provider: env.PAYMENT_PROVIDER, mockWebhookSecret: env.MOCK_WEBHOOK_SECRET }),
      platformFeeBps: env.PLATFORM_FEE_BPS,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "unknown_error";
    const clientErrors = ["creator_not_found"];
    return NextResponse.json({ error: clientErrors.includes(code) ? code : code.startsWith("[") ? "invalid_tip" : code }, { status: clientErrors.includes(code) ? 404 : code.includes("invalid") || code.startsWith("[") ? 400 : 500 });
  }
}

