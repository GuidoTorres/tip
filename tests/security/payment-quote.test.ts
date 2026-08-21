import { describe, expect, it } from "vitest";
import { createPaymentQuote, verifyPaymentQuote } from "@/lib/security/payment-quote";

const payload = {
  creatorId: "creator-1", paymentAccountId: "account-1", amountUsdMinor: 2_000,
  localAmountMinor: 6_722, currency: "PEN" as const, rate: 3.361,
  quotedAt: "2026-08-21T14:00:00.000Z", expiresAt: "2026-08-21T14:10:00.000Z",
  source: "mercadopago" as const,
};

describe("payment quote signatures", () => {
  it("round-trips an untampered quote before expiry", () => {
    const token = createPaymentQuote(payload, "test-secret");
    expect(verifyPaymentQuote(token, "test-secret", new Date("2026-08-21T14:09:59.000Z"))).toEqual(payload);
  });

  it("rejects a modified quote", () => {
    const token = createPaymentQuote(payload, "test-secret");
    const [body, signature] = token.split(".");
    const changed = Buffer.from(JSON.stringify({ ...payload, localAmountMinor: 1 }), "utf8").toString("base64url");
    expect(() => verifyPaymentQuote(`${changed}.${signature}`, "test-secret", new Date("2026-08-21T14:01:00.000Z")))
      .toThrow("payment_quote_invalid");
    expect(body).not.toBe(changed);
  });

  it("rejects an expired quote", () => {
    const token = createPaymentQuote(payload, "test-secret");
    expect(() => verifyPaymentQuote(token, "test-secret", new Date("2026-08-21T14:10:00.001Z")))
      .toThrow("payment_quote_expired");
  });
});
