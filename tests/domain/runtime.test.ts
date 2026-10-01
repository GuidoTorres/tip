import { afterEach, describe, expect, it, vi } from "vitest";
import { getServerEnv } from "@/lib/env/server";
import { getPaymentProviderFromEnv } from "@/features/payments/provider-factory";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("payment runtime", () => {
  it("rejects retired payment providers", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "dlocalgo");

    expect(() => getServerEnv()).toThrow();
  });

  it("builds the PayPal provider from server configuration", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "paypal");

    expect(getPaymentProviderFromEnv(getServerEnv()).name).toBe("paypal");
  });
});
