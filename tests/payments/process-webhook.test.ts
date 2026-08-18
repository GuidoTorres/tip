import { describe, expect, it, vi } from "vitest";
import { processPaymentWebhook, type WebhookRepository } from "@/features/payments/process-webhook";
import type { PaymentProvider, PaymentWebhookEvent } from "@/features/payments/provider";

const event: PaymentWebhookEvent = { eventId: "evt-1", providerPaymentId: "pay-1", providerCaptureId: null, status: "confirmed", gatewayFeeMinor: 80, occurredAt: "2026-08-12T20:00:00.000Z" };

function setup(overrides?: { verified?: boolean; newlyProcessed?: boolean; event?: PaymentWebhookEvent }) {
  const parsed = overrides?.event ?? event;
  const provider: PaymentProvider = {
    name: "mock", createPayment: vi.fn(), getPaymentStatus: vi.fn(), capturePayment: vi.fn(), createPayout: vi.fn(), getPayoutStatus: vi.fn(),
    verifyWebhook: vi.fn().mockResolvedValue(overrides?.verified ?? true), parseWebhook: vi.fn().mockResolvedValue(parsed),
  };
  const repository: WebhookRepository = {
    confirm: vi.fn().mockResolvedValue({ newlyProcessed: overrides?.newlyProcessed ?? true, notification: { id: "note-1", creatorId: "creator-1", type: "tip_confirmed" }, tip: { id: "tip-1", amountMinor: 2_000, currency: "USD", payerName: "Mateo", message: "Prueba ❤️", anonymous: false, locale: "es" } }),
    reject: vi.fn().mockResolvedValue(true), reverse: vi.fn().mockResolvedValue(true), markPushAttempted: vi.fn().mockResolvedValue(undefined),
  };
  const push = vi.fn().mockResolvedValue({ sent: 2, revoked: 0, failed: 0 });
  return { provider, repository, push };
}

describe("processPaymentWebhook", () => {
  it("confirma server-side y envía una sola notificación lógica", async () => {
    const deps = setup();
    const result = await processPaymentWebhook("raw", new Headers({ "x-tipme-signature": "signature" }), deps);
    expect(result).toEqual({ ok: true, duplicate: false, status: "confirmed" });
    expect(deps.repository.confirm).toHaveBeenCalledTimes(1);
    expect(deps.push).toHaveBeenCalledTimes(1);
  });

  it("rechaza una firma inválida sin efectos", async () => {
    const deps = setup({ verified: false });
    await expect(processPaymentWebhook("raw", new Headers({ "x-tipme-signature": "bad" }), deps)).rejects.toThrow("invalid_webhook");
    expect(deps.repository.confirm).not.toHaveBeenCalled();
    expect(deps.push).not.toHaveBeenCalled();
  });

  it("no repite dinero ni push para un evento duplicado", async () => {
    const deps = setup({ newlyProcessed: false });
    const result = await processPaymentWebhook("raw", new Headers({ "x-tipme-signature": "signature" }), deps);
    expect(result.duplicate).toBe(true);
    expect(deps.push).not.toHaveBeenCalled();
  });

  it("mantiene confirmado el webhook cuando falla Web Push", async () => {
    const deps = setup();
    deps.push.mockRejectedValue(new Error("push_transport_failed"));
    await expect(processPaymentWebhook("raw", new Headers({ "x-tipme-signature": "signature" }), deps)).resolves.toEqual({ ok: true, duplicate: false, status: "confirmed", pushFailed: true });
    expect(deps.repository.confirm).toHaveBeenCalledTimes(1);
  });

  it.each(["pending", "rejected"] as const)("no envía push de dinero recibido para %s", async (status) => {
    const deps = setup({ event: { ...event, status } });
    const result = await processPaymentWebhook("raw", new Headers({ "x-tipme-signature": "signature" }), deps);
    expect(result.status).toBe(status);
    expect(deps.push).not.toHaveBeenCalled();
  });
});
