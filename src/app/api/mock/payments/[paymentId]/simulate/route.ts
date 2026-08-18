import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";
import { signMockWebhook } from "@/lib/security/hmac";
import { createReceiptToken } from "@/lib/security/receipt";
import { handlePaymentWebhook } from "@/features/payments/webhook-handler";
import { mockSimulatorAllowed } from "@/lib/env/runtime";

const schema = z.object({ status: z.enum(["confirmed", "pending", "rejected"]), eventId: z.string().min(1).max(120).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  if (!mockSimulatorAllowed(process.env)) return new NextResponse(null, { status: 404 });
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER !== "mock") return new NextResponse(null, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_simulation" }, { status: 400 });
  const { paymentId } = await params;
  const admin = createAdminSupabaseClient();
  const { data: tip } = await admin.from("tips").select("id").eq("provider", "mock").eq("provider_payment_id", paymentId).single();
  if (!tip) return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  const timestamp = Math.floor(Date.now() / 1000);
  const event = {
    eventId: parsed.data.eventId ?? `mock_evt_${crypto.randomUUID()}`,
    providerPaymentId: paymentId,
    status: parsed.data.status,
    gatewayFeeMinor: null,
    occurredAt: new Date(timestamp * 1000).toISOString(),
  };
  const rawBody = JSON.stringify(event);
  const signature = signMockWebhook(rawBody, timestamp, env.MOCK_WEBHOOK_SECRET);
  const result = await handlePaymentWebhook(rawBody, new Headers({ "x-tipme-signature": signature }));
  const token = createReceiptToken(tip.id, env.RECEIPT_SIGNING_SECRET);
  return NextResponse.json({ ...result, receiptUrl: `/tips/${tip.id}/receipt?token=${encodeURIComponent(token)}` });
}
