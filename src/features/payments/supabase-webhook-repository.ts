import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentWebhookEvent } from "./provider";
import type { WebhookRepository } from "./process-webhook";
import type { Currency } from "./types";
import { creatorVisibleTipAmount } from "./creator-visible-amount";

export class SupabaseWebhookRepository implements WebhookRepository {
  constructor(private readonly client: SupabaseClient, private readonly providerName: string) {}

  private async paymentId(event: PaymentWebhookEvent) {
    if (!event.providerCaptureId || event.providerPaymentId !== event.providerCaptureId) return event.providerPaymentId;
    const { data } = await this.client.from("tips").select("provider_payment_id")
      .eq("provider", this.providerName).eq("provider_capture_id", event.providerCaptureId).maybeSingle();
    return data?.provider_payment_id as string | undefined ?? event.providerPaymentId;
  }

  private async attachCapture(event: PaymentWebhookEvent) {
    if (!event.providerCaptureId || event.providerPaymentId === event.providerCaptureId) return;
    await this.client.from("tips").update({ provider_capture_id: event.providerCaptureId })
      .eq("provider", this.providerName).eq("provider_payment_id", event.providerPaymentId);
  }

  async confirm(event: PaymentWebhookEvent, payloadDigest: string) {
    await this.attachCapture(event);
    const paymentId = await this.paymentId(event);
    const { data, error } = await this.client.rpc("confirm_tip_from_webhook", {
      p_provider: this.providerName, p_event_id: event.eventId, p_payment_id: paymentId,
      p_payload_digest: payloadDigest, p_gateway_fee_minor: event.gatewayFeeMinor, p_provider_confirmed_at: event.occurredAt,
    }).single();
    if (error) throw new Error("confirm_tip_failed");
    const result = data as { newly_processed: boolean; notification_id: string | null; creator_id: string | null; tip_id: string | null };
    if (!result.newly_processed || !result.tip_id || !result.creator_id || !result.notification_id) return { newlyProcessed: false };
    const { data: tip, error: tipError } = await this.client.from("tips").select("id,base_amount_minor,amount_minor,currency,payer_name,message,anonymous,profiles!tips_creator_id_fkey(locale)").eq("id", result.tip_id).single();
    if (tipError) throw new Error("confirmed_tip_read_failed");
    const row = tip as unknown as { id: string; base_amount_minor: number | null; amount_minor: number; currency: Currency; payer_name: string | null; message: string | null; anonymous: boolean; profiles: { locale: "es" | "en" } | null };
    return {
      newlyProcessed: true,
      notification: { id: result.notification_id, creatorId: result.creator_id, type: "tip_confirmed" as const },
      tip: { id: row.id, amountMinor: creatorVisibleTipAmount(row), currency: row.currency, payerName: row.payer_name, message: row.message, anonymous: row.anonymous, locale: row.profiles?.locale ?? "es" },
    };
  }

  async reject(event: PaymentWebhookEvent, payloadDigest: string) {
    await this.attachCapture(event);
    const paymentId = await this.paymentId(event);
    const { data, error } = await this.client.rpc("reject_tip_from_webhook", { p_provider: this.providerName, p_event_id: event.eventId, p_payment_id: paymentId, p_payload_digest: payloadDigest, p_occurred_at: event.occurredAt });
    if (error) throw new Error("reject_tip_failed");
    return Boolean(data);
  }

  async reverse(event: PaymentWebhookEvent, payloadDigest: string) {
    const paymentId = await this.paymentId(event);
    const { data, error } = await this.client.rpc("reverse_tip_from_webhook", { p_provider: this.providerName, p_event_id: event.eventId, p_payment_id: paymentId, p_payload_digest: payloadDigest, p_reversal: event.status, p_occurred_at: event.occurredAt }).single();
    if (error) throw new Error("reverse_tip_failed");
    return Boolean((data as { newly_processed?: boolean } | null)?.newly_processed);
  }

  async recordPending(event: PaymentWebhookEvent, payloadDigest: string) {
    await this.attachCapture(event);
    const { error } = await this.client.from("webhook_events").insert({ provider: this.providerName, provider_event_id: event.eventId, event_kind: "payment", payload_digest: payloadDigest, status: "processed", provider_confirmed_at: event.occurredAt, processed_at: new Date().toISOString() });
    return !error;
  }

  async recordIgnored(event: PaymentWebhookEvent, payloadDigest: string) {
    const { error } = await this.client.from("webhook_events").insert({ provider: this.providerName, provider_event_id: event.eventId, event_kind: "payment", payload_digest: payloadDigest, status: "ignored", error_code: "unsupported_event", provider_confirmed_at: event.occurredAt, processed_at: new Date().toISOString() });
    return !error;
  }

  async markPushAttempted(eventId: string) {
    await this.client.from("webhook_events").update({ push_attempted_at: new Date().toISOString() }).eq("provider", this.providerName).eq("provider_event_id", eventId);
  }
}
