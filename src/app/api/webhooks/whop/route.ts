import { NextResponse } from "next/server";
import { handlePaymentWebhook } from "@/features/payments/webhook-handler";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const result = await handlePaymentWebhook(rawBody, request.headers);
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "webhook_failed";
    console.error(JSON.stringify({ event: "whop_webhook_error", code, receivedAt: new Date().toISOString() }));
    return NextResponse.json({ error: code === "invalid_webhook" ? "invalid_webhook" : "webhook_failed" }, { status: code === "invalid_webhook" ? 401 : 500 });
  }
}
