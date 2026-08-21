import { WebhookSignatureValidator } from "mercadopago";
import type { PaymentWebhookEvent } from "./provider";
import { supportedCurrencies, type Currency } from "./types";
import { currencyFractionDigits } from "./mercadopago-exchange-rate";

export type MercadoPagoWebhookPayload = {
  id?: string | number;
  type?: string;
  topic?: string;
  resource?: string | number;
  action?: string;
  data?: { id?: string | number };
};

export type MercadoPagoPaymentResource = {
  id?: string | number;
  status?: string;
  collector_id?: string | number;
  external_reference?: string;
  currency_id?: string;
  transaction_amount?: number;
  application_fee?: number;
  date_last_updated?: string;
  date_approved?: string;
  fee_details?: Array<{ type?: string; amount?: number }>;
  transaction_details?: { net_received_amount?: number };
};

function majorToMinor(value: unknown, currency: Currency) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const minor = Math.round(value * 10 ** currencyFractionDigits(currency));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function parseMercadoPagoWebhook(rawBody: string): { payload: MercadoPagoWebhookPayload; dataId: string; action: string } {
  let payload: MercadoPagoWebhookPayload;
  try { payload = JSON.parse(rawBody) as MercadoPagoWebhookPayload; } catch { throw new Error("invalid_webhook"); }
  const dataId = payload.data?.id !== undefined
    ? String(payload.data.id)
    : payload.resource !== undefined
      ? String(payload.resource)
      : "";
  const eventType = payload.type ?? payload.topic;
  if (!dataId || (eventType && eventType !== "payment")) throw new Error("invalid_webhook");
  return { payload, dataId, action: payload.action ?? eventType ?? "payment.updated" };
}

export function verifyMercadoPagoWebhook(headers: Headers, dataId: string, secret: string) {
  try {
    WebhookSignatureValidator.validate({
      xSignature: headers.get("x-signature"),
      xRequestId: headers.get("x-request-id"),
      dataId,
      secret,
      toleranceSeconds: 300,
    });
    return true;
  } catch (error) {
    console.warn(JSON.stringify({
      event: "mercadopago_webhook_signature_invalid",
      reason: error instanceof Error ? error.message.slice(0, 160) : "unknown",
      dataId,
    }));
    return false;
  }
}

export function validateMercadoPagoPayment(payment: MercadoPagoPaymentResource, expected: {
  paymentId: string; tipId: string; merchantId: string; amountMinor: number; platformFeeMinor: number; currency: Currency;
}) {
  const valid = String(payment.id ?? "") === expected.paymentId
    && String(payment.collector_id ?? "") === expected.merchantId
    && payment.external_reference === expected.tipId
    && payment.currency_id === expected.currency
    && majorToMinor(payment.transaction_amount, expected.currency) === expected.amountMinor
    && majorToMinor(payment.application_fee ?? 0, expected.currency) === expected.platformFeeMinor;
  if (!valid) throw new Error("mercadopago_payment_mismatch");
}

export function mercadoPagoEventFromPayment(payment: MercadoPagoPaymentResource, action: string): PaymentWebhookEvent {
  const status = ({
    approved: "confirmed", pending: "pending", in_process: "pending", authorized: "pending",
    rejected: "rejected", cancelled: "rejected", refunded: "refunded", charged_back: "chargeback",
  } as const)[payment.status as "approved"] ?? "ignored";
  const gatewayFees = payment.fee_details?.filter((fee) => fee.type !== "application_fee" && fee.type !== "marketplace_fee") ?? [];
  const currency = supportedCurrencies.includes(payment.currency_id as Currency) ? payment.currency_id as Currency : null;
  if (!currency) throw new Error("mercadopago_payment_invalid");
  const gatewayFeeMinor = gatewayFees.length
    ? gatewayFees.reduce((sum, fee) => sum + (majorToMinor(fee.amount, currency) ?? 0), 0)
    : null;
  const paymentId = String(payment.id ?? "");
  if (!paymentId) throw new Error("mercadopago_payment_invalid");
  const occurredAt = payment.date_last_updated ?? payment.date_approved ?? new Date().toISOString();
  return {
    kind: "payment",
    eventId: `mp:${action}:${paymentId}:${payment.status ?? "unknown"}:${occurredAt}`,
    providerPaymentId: paymentId,
    providerCaptureId: null,
    status,
    gatewayFeeMinor,
    occurredAt,
  };
}

export async function getMercadoPagoPayment(paymentId: string, accessToken: string, fetchImpl: typeof fetch = fetch): Promise<MercadoPagoPaymentResource> {
  const response = await fetchImpl(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("mercadopago_payment_lookup_failed");
  return response.json() as Promise<MercadoPagoPaymentResource>;
}
