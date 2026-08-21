import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServerEnv } from "@/lib/env/server";
import { getMercadoPagoRegion, type MercadoPagoCountry } from "./mercadopago-regions";
import { MercadoPagoCredentialManager } from "./mercadopago-credential-manager";
import { getMercadoPagoPayment, mercadoPagoEventFromPayment, parseMercadoPagoWebhook, validateMercadoPagoPayment, verifyMercadoPagoWebhook } from "./mercadopago-webhook";
import { SupabaseWebhookRepository } from "./supabase-webhook-repository";
import { processPaymentWebhook } from "./process-webhook";
import { sendTipPush } from "@/features/notifications/web-push";
import type { PaymentProvider } from "./provider";
import type { Currency } from "./types";

export async function handleMercadoPagoWebhook(input: { rawBody: string; headers: Headers; country: MercadoPagoCountry }, dependencies: { admin: SupabaseClient; env: ServerEnv; fetchImpl?: typeof fetch }) {
  const parsed = parseMercadoPagoWebhook(input.rawBody);
  const region = getMercadoPagoRegion(input.country, dependencies.env);
  console.info(JSON.stringify({
    event: "mercadopago_webhook_received",
    country: input.country,
    dataId: parsed.dataId,
    signaturePresent: Boolean(input.headers.get("x-signature")),
    requestIdPresent: Boolean(input.headers.get("x-request-id")),
  }));
  if (!verifyMercadoPagoWebhook(input.headers, parsed.dataId, region.webhookSecret)) throw new Error("invalid_webhook");

  const { data: tip, error: tipError } = await dependencies.admin.from("tips")
    .select("id,creator_id,amount_minor,currency,platform_fee_minor,provider_payment_id")
    .eq("provider", "mercadopago").eq("provider_payment_id", parsed.dataId).maybeSingle();
  if (tipError || !tip) throw new Error("mercadopago_tip_lookup_failed");
  const { data: account, error: accountError } = await dependencies.admin.from("payment_accounts")
    .select("id,provider_merchant_id,provider_country,provider_currency")
    .eq("creator_id", tip.creator_id).eq("provider", "mercadopago").eq("status", "connected").maybeSingle();
  if (accountError || !account || account.provider_country !== input.country || account.provider_currency !== tip.currency) throw new Error("mercadopago_account_mismatch");
  const credential = await new MercadoPagoCredentialManager(dependencies.admin, dependencies.env, dependencies.fetchImpl).findByAccountId(account.id as string, input.country);
  if (!credential) throw new Error("mercadopago_credentials_missing");
  const payment = await getMercadoPagoPayment(parsed.dataId, credential.accessToken, dependencies.fetchImpl);
  validateMercadoPagoPayment(payment, {
    paymentId: parsed.dataId,
    tipId: tip.id as string,
    merchantId: account.provider_merchant_id as string,
    amountMinor: tip.amount_minor as number,
    platformFeeMinor: tip.platform_fee_minor as number,
    currency: tip.currency as Currency,
  });
  const event = mercadoPagoEventFromPayment(payment, parsed.action);
  const provider: PaymentProvider = {
    name: "mercadopago",
    createPayment: async () => { throw new Error("not_available"); },
    getPaymentStatus: async () => "pending",
    capturePayment: async () => ({ status: "pending", providerCaptureId: null }),
    verifyWebhook: async () => true,
    parseWebhook: async () => event,
    createPayout: async () => { throw new Error("payouts_managed_by_mercadopago"); },
    getPayoutStatus: async () => "processing",
  };
  const repository = new SupabaseWebhookRepository(dependencies.admin, "mercadopago");
  return processPaymentWebhook(input.rawBody, input.headers, {
    provider,
    repository,
    push: async (tipPush) => sendTipPush(dependencies.admin, tip.creator_id as string, tipPush),
  });
}
