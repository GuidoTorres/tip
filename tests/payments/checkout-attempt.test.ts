import { describe, expect, it, vi } from "vitest";
import { createCheckoutAttempt } from "@/features/payments/checkout-attempt";

describe("checkout attempt", () => {
  it("reuses one in-flight order for concurrent PayPal callbacks", async () => {
    const factory = vi.fn().mockResolvedValue({ tipId: "tip-1", orderId: "ORDER-1", receiptToken: "token" });
    const attempt = createCheckoutAttempt(factory);

    const [first, second] = await Promise.all([attempt.getOrCreate(), attempt.getOrCreate()]);

    expect(first).toEqual({ tipId: "tip-1", orderId: "ORDER-1", receiptToken: "token" });
    expect(second).toEqual(first);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("allows retry when creation fails before an order exists", async () => {
    const factory = vi.fn()
      .mockRejectedValueOnce(new Error("network_failed"))
      .mockResolvedValueOnce({ tipId: "tip-2", orderId: "ORDER-2", receiptToken: "token-2" });
    const attempt = createCheckoutAttempt(factory);

    await expect(attempt.getOrCreate()).rejects.toThrow("network_failed");
    await expect(attempt.getOrCreate()).resolves.toEqual({ tipId: "tip-2", orderId: "ORDER-2", receiptToken: "token-2" });
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
