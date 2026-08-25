import { NextResponse } from "next/server";
import { captureTip, SupabaseCaptureTipRepository } from "@/features/payments/capture-tip";
import { getPaymentProviderFromEnv } from "@/features/payments/provider-factory";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ tipId: string }> }) {
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER !== "paypal") return new NextResponse(null, { status: 404 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`paypal-capture:${ip}`, 20, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const { tipId } = await params;
  const body = await request.json().catch(() => null) as { receiptToken?: unknown } | null;
  if (typeof body?.receiptToken !== "string") return NextResponse.json({ error: "invalid_capture" }, { status: 400 });
  try {
    const result = await captureTip({ tipId, receiptToken: body.receiptToken }, {
      repository: new SupabaseCaptureTipRepository(createAdminSupabaseClient(), env.PAYPAL_FLOW),
      provider: getPaymentProviderFromEnv(env),
      receiptSecret: env.RECEIPT_SIGNING_SECRET,
      paypalFlow: env.PAYPAL_FLOW,
      ...(env.PAYPAL_SANDBOX_SINGLE_MERCHANT ? { providerAccountOverride: env.PAYPAL_PARTNER_MERCHANT_ID } : {}),
    });
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "capture_failed";
    return NextResponse.json({ error: code === "capture_not_found" ? "not_found" : "capture_failed" }, { status: code === "capture_not_found" ? 404 : 502 });
  }
}
