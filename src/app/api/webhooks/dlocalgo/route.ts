import { NextResponse } from "next/server";
import { handlePaymentWebhook } from "@/features/payments/webhook-handler";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const result = await handlePaymentWebhook(rawBody, request.headers);
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "webhook_failed";
    console.error(JSON.stringify({ event: "dlocalgo_webhook_error", code, receivedAt: new Date().toISOString() }));
    // dLocal Go reintenta cada 10 minutos durante 30 días mientras no reciba 200,
    // así que un fallo transitorio debe devolver error para que vuelva a intentarlo.
    return NextResponse.json({ error: code === "invalid_webhook" ? "invalid_webhook" : "webhook_failed" }, { status: code === "invalid_webhook" ? 401 : 500 });
  }
}
