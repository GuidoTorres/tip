import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { DLocalGoPaymentProvider } from "@/features/payments/dlocalgo-provider";

const config = {
  apiKey: "api-key-test",
  secretKey: "secret-key-test",
  environment: "sandbox" as const,
  appUrl: "https://tipme.pro",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function signed(rawBody: string) {
  const signature = createHmac("sha256", config.secretKey).update(`${config.apiKey}${rawBody}`).digest("hex");
  return new Headers({ authorization: `V2-HMAC-SHA256, Signature: ${signature}` });
}

describe("DLocalGoPaymentProvider", () => {
  it("creates a split payment and returns the hosted checkout url", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      id: "DP-54354", status: "PENDING", redirect_url: "https://checkout-sbx.dlocalgo.com/validate/abc",
    }, 200));
    const provider = new DLocalGoPaymentProvider({ ...config, fetchImpl: fetchImpl as typeof fetch });

    const result = await provider.createPayment({
      tipId: "tip-1", amountMinor: 2_000, platformFeeMinor: 20, currency: "USD",
      providerAccountId: "SPLIT-CODE-1", providerCountry: "CO", idempotencyKey: "create:tip-1",
    });

    const [url, options] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api-sbx.dlocalgo.com/v1/payments");
    expect(new Headers(options.headers).get("authorization")).toBe("Bearer api-key-test:secret-key-test");
    expect(JSON.parse(String(options.body))).toMatchObject({
      amount: 20,
      currency: "USD",
      order_id: "tip-1",
      split_code: "SPLIT-CODE-1",
      country: "CO",
      notification_url: "https://tipme.pro/api/webhooks/dlocalgo",
    });
    expect(result).toEqual({
      providerPaymentId: "DP-54354",
      status: "pending",
      checkout: { kind: "redirect", url: "https://checkout-sbx.dlocalgo.com/validate/abc" },
      gatewayFeeMinor: null,
    });
  });

  it("fails closed without the split code of the creator", async () => {
    const provider = new DLocalGoPaymentProvider({ ...config, fetchImpl: vi.fn() as typeof fetch });
    await expect(provider.createPayment({
      tipId: "tip-1", amountMinor: 2_000, platformFeeMinor: 20, currency: "USD",
      providerAccountId: null, idempotencyKey: "key",
    })).rejects.toThrow("dlocalgo_split_code_missing");
  });

  it("does not send a non-HTTPS notification url", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "DP-1", redirect_url: "https://checkout/x" }));
    const provider = new DLocalGoPaymentProvider({ ...config, appUrl: "http://localhost:3000", fetchImpl: fetchImpl as typeof fetch });

    await provider.createPayment({
      tipId: "tip-1", amountMinor: 500, platformFeeMinor: 5, currency: "USD",
      providerAccountId: "SPLIT-1", idempotencyKey: "key",
    });

    expect(JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body))).not.toHaveProperty("notification_url");
  });

  it("accepts a correctly signed notification", async () => {
    const provider = new DLocalGoPaymentProvider({ ...config, fetchImpl: vi.fn() as typeof fetch });
    const rawBody = JSON.stringify({ payment_id: "DP-283" });

    await expect(provider.verifyWebhook({ rawBody, headers: signed(rawBody) })).resolves.toBe(true);
  });

  it("rejects a tampered notification body", async () => {
    const provider = new DLocalGoPaymentProvider({ ...config, fetchImpl: vi.fn() as typeof fetch });
    const headers = signed(JSON.stringify({ payment_id: "DP-283" }));

    await expect(provider.verifyWebhook({
      rawBody: JSON.stringify({ payment_id: "DP-999" }),
      headers,
    })).resolves.toBe(false);
  });

  it("rejects a notification without a signature header", async () => {
    const provider = new DLocalGoPaymentProvider({ ...config, fetchImpl: vi.fn() as typeof fetch });
    await expect(provider.verifyWebhook({ rawBody: "{}", headers: new Headers() })).resolves.toBe(false);
  });

  it("reads the authoritative payment because the notification carries no status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      id: "DP-283", status: "PAID", created_date: "2026-08-24T12:00:00",
    }));
    const provider = new DLocalGoPaymentProvider({ ...config, fetchImpl: fetchImpl as typeof fetch });

    const event = await provider.parseWebhook(JSON.stringify({ payment_id: "DP-283" }));

    expect(fetchImpl.mock.calls[0][0]).toBe("https://api-sbx.dlocalgo.com/v1/payments/DP-283");
    expect(event).toMatchObject({ kind: "payment", providerPaymentId: "DP-283", status: "confirmed" });
  });

  it.each([
    ["PAID", "confirmed"],
    ["PENDING", "pending"],
    ["REJECTED", "rejected"],
    ["CANCELLED", "rejected"],
    ["EXPIRED", "rejected"],
    ["REFUNDED", "refunded"],
    ["CHARGEBACK", "chargeback"],
    ["SOMETHING_NEW", "ignored"],
  ])("maps provider status %s to %s", async (providerStatus, expected) => {
    const provider = new DLocalGoPaymentProvider({
      ...config,
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ id: "DP-9", status: providerStatus })) as typeof fetch,
    });

    const event = await provider.parseWebhook(JSON.stringify({ payment_id: "DP-9" }));
    expect(event.status).toBe(expected);
  });
});
