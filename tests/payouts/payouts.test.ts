import { describe, expect, it, vi } from "vitest";
import { requestPayout, processPayoutEvent, type PayoutRepository } from "@/features/payouts/service";
import type { PaymentProvider } from "@/features/payments/provider";

function setup(overrides?: { balance?: number; verified?: boolean; newlyProcessed?: boolean }) {
  const repository: PayoutRepository = {
    getAccount: vi.fn().mockResolvedValue({ id: "acct-1", creatorId: "creator-1", providerAccountId: "provider-acct", provider: "mock", verified: overrides?.verified ?? true, country: "PE", bankName: "Banco Demo", last4: "4821" }),
    getAvailableBalance: vi.fn().mockResolvedValue(overrides?.balance ?? 2_000),
    reservePayout: vi.fn().mockResolvedValue({ id: "payout-1" }),
    attachProviderPayout: vi.fn().mockResolvedValue(undefined),
    transitionFromProvider: vi.fn().mockResolvedValue({ newlyProcessed: overrides?.newlyProcessed ?? true, creatorId: "creator-1", payoutId: "payout-1", amountMinor: 1_000, currency: "USD", status: "completed" }),
  };
  const provider: PaymentProvider = {
    name: "mock", createPayment: vi.fn(), getPaymentStatus: vi.fn(), verifyWebhook: vi.fn(), parseWebhook: vi.fn(),
    createPayout: vi.fn().mockResolvedValue({ providerPayoutId: "mock_po_1", status: "requested" }), getPayoutStatus: vi.fn(),
  };
  return { repository, provider };
}

describe("requestPayout", () => {
  it("reserva exactamente el saldo disponible", async () => {
    const deps = setup();
    const result = await requestPayout({ creatorId: "creator-1", accountId: "acct-1", amountMinor: 2_000, currency: "USD", idempotencyKey: "key-0001" }, deps);
    expect(result).toEqual({ payoutId: "payout-1", providerPayoutId: "mock_po_1", status: "requested" });
    expect(deps.repository.reservePayout).toHaveBeenCalledTimes(1);
  });

  it("rechaza un retiro mayor al disponible antes de invocar al provider", async () => {
    const deps = setup({ balance: 1_999 });
    await expect(requestPayout({ creatorId: "creator-1", accountId: "acct-1", amountMinor: 2_000, currency: "USD", idempotencyKey: "key-0001" }, deps)).rejects.toThrow("insufficient_balance");
    expect(deps.provider.createPayout).not.toHaveBeenCalled();
  });

  it("rechaza cuenta no verificada", async () => {
    const deps = setup({ verified: false });
    await expect(requestPayout({ creatorId: "creator-1", accountId: "acct-1", amountMinor: 1_000, currency: "USD", idempotencyKey: "key-0001" }, deps)).rejects.toThrow("payout_account_not_verified");
  });

  it("rechaza retiros nuevos en una moneda distinta de USD", async () => {
    const deps = setup();

    await expect(requestPayout({ creatorId: "creator-1", accountId: "acct-1", amountMinor: 1_000, currency: "EUR", idempotencyKey: "key-0001" }, deps)).rejects.toThrow();

    expect(deps.repository.getAccount).not.toHaveBeenCalled();
    expect(deps.provider.createPayout).not.toHaveBeenCalled();
  });
});

describe("processPayoutEvent", () => {
  it("crea una sola notificación lógica al completar", async () => {
    const deps = setup(); const notify = vi.fn();
    await processPayoutEvent({ provider: "mock", eventId: "evt-1", providerPayoutId: "mock_po_1", status: "completed", payloadDigest: "digest" }, { repository: deps.repository, notify });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(notify.mock.calls[0])).not.toContain("4821");
    expect(JSON.stringify(notify.mock.calls[0])).not.toContain("Banco Demo");
  });

  it("no duplica notificación para evento repetido", async () => {
    const deps = setup({ newlyProcessed: false }); const notify = vi.fn();
    await processPayoutEvent({ provider: "mock", eventId: "evt-1", providerPayoutId: "mock_po_1", status: "completed", payloadDigest: "digest" }, { repository: deps.repository, notify });
    expect(notify).not.toHaveBeenCalled();
  });

  it("mantiene completado el retiro aunque falle el transporte Push", async () => {
    const deps = setup();
    await expect(processPayoutEvent({ provider: "mock", eventId: "evt-1", providerPayoutId: "mock_po_1", status: "completed", payloadDigest: "digest" }, { repository: deps.repository, notify: vi.fn().mockRejectedValue(new Error("push_failed")) })).resolves.toEqual(expect.objectContaining({ newlyProcessed: true, pushFailed: true }));
  });
});
