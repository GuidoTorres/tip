import { describe, expect, it, vi } from "vitest";
import { SupabaseWebhookRepository } from "@/features/payments/supabase-webhook-repository";

function queryResult(data: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "update", "insert"]) chain[method] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve);
  return chain;
}

describe("SupabaseWebhookRepository provider isolation", () => {
  it("uses PayPal for RPC, capture attachment, and push-attempt lookup", async () => {
    const tips = queryResult();
    const webhooks = queryResult();
    const client = {
      from: vi.fn((table: string) => table === "tips" ? tips : webhooks),
      rpc: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { newly_processed: false, notification_id: null, creator_id: null, tip_id: null }, error: null }) }),
    };
    const repository = new SupabaseWebhookRepository(client as never, "paypal");
    await repository.confirm({ kind: "payment", eventId: "WH-1", providerPaymentId: "ORDER-1", providerCaptureId: "CAPTURE-1", status: "confirmed", gatewayFeeMinor: 138, occurredAt: "2026-08-16T20:00:00.000Z" }, "digest");
    expect(client.rpc).toHaveBeenCalledWith("confirm_tip_from_webhook", expect.objectContaining({ p_provider: "paypal", p_payment_id: "ORDER-1" }));
    expect(vi.mocked(tips.update as never)).toHaveBeenCalledWith({ provider_capture_id: "CAPTURE-1" });
  });

  it("uses the base tip amount in the creator push instead of processing support", async () => {
    const tips = queryResult({
      id: "tip-1",
      base_amount_minor: 2000,
      amount_minor: 2146,
      currency: "USD",
      payer_name: "Mateo",
      message: "Gracias",
      anonymous: false,
      profiles: { locale: "es" },
    });
    const client = {
      from: vi.fn(() => tips),
      rpc: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { newly_processed: true, notification_id: "note-1", creator_id: "creator-1", tip_id: "tip-1" }, error: null }) }),
    };
    const repository = new SupabaseWebhookRepository(client as never, "paypal");

    const result = await repository.confirm({ kind: "payment", eventId: "WH-2", providerPaymentId: "ORDER-2", providerCaptureId: null, status: "confirmed", gatewayFeeMinor: 146, occurredAt: "2026-08-20T20:00:00.000Z" }, "digest");

    expect(result.tip?.amountMinor).toBe(2000);
  });
});
