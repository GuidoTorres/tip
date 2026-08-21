import { NextRequest, NextResponse } from "next/server";
import { handleMercadoPagoWebhook } from "@/features/payments/mercadopago-webhook-handler";
import { isMercadoPagoCountry } from "@/features/payments/mercadopago-regions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ country: string }> }) {
  const { country } = await params;
  if (!isMercadoPagoCountry(country)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const rawBody = await request.text();
  console.info(JSON.stringify({
    event: "mercadopago_webhook_http_received",
    country,
    method: request.method,
    bodyLength: rawBody.length,
    bodyPrefix: rawBody.slice(0, 240),
    query: new URL(request.url).search,
    signaturePresent: Boolean(request.headers.get("x-signature")),
    requestIdPresent: Boolean(request.headers.get("x-request-id")),
  }));
  try {
    const result = await handleMercadoPagoWebhook({ rawBody, headers: request.headers, country }, { admin: createAdminSupabaseClient(), env: getServerEnv() });
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "webhook_failed";
    console.error(JSON.stringify({ event: "mercadopago_webhook_error", country, code, receivedAt: new Date().toISOString() }));
    return NextResponse.json({ error: code === "invalid_webhook" ? "invalid_webhook" : "webhook_failed" }, { status: code === "invalid_webhook" ? 401 : 500 });
  }
}
