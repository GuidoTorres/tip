import { describe, expect, it } from "vitest";
import { MockPaymentProvider } from "@/features/payments/mock-provider";
import { getPaymentProvider } from "@/features/payments/provider-factory";

describe("MockPaymentProvider", () => {
  it("crea el mismo identificador para una clave idempotente", async () => {
    const provider = new MockPaymentProvider("secret-that-is-long-enough");
    const input = { tipId: "tip-1", amountMinor: 2_000, platformFeeMinor: 60, currency: "USD" as const, providerAccountId: null, idempotencyKey: "create:tip-1" };
    const first = await provider.createPayment(input);
    const second = await provider.createPayment(input);

    expect(first).toEqual(second);
    expect(first.status).toBe("pending");
    expect(first.checkout).toEqual({ kind: "redirect", url: expect.stringContaining(first.providerPaymentId) });
  });

});

describe("getPaymentProvider", () => {
  it("solo habilita mock hasta tener adaptadores documentados", () => {
    expect(getPaymentProvider({ provider: "mock", mockWebhookSecret: "secret-that-is-long-enough" }).name).toBe("mock");
    expect(() => getPaymentProvider({ provider: "nuvei" as never, mockWebhookSecret: "secret-that-is-long-enough" })).toThrow("not implemented");
  });
});
