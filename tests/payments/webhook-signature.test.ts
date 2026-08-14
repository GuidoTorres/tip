import { describe, expect, it } from "vitest";
import { signMockWebhook, verifyMockWebhook } from "@/lib/security/hmac";

describe("mock webhook signature", () => {
  const secret = "a-test-secret-that-is-long-enough";
  const timestamp = 1_800_000_000;
  const body = JSON.stringify({ id: "evt_1", status: "confirmed" });

  it("acepta cuerpo y timestamp firmados", () => {
    const signature = signMockWebhook(body, timestamp, secret);
    expect(verifyMockWebhook(body, signature, secret, timestamp + 30)).toBe(true);
  });

  it("rechaza un cuerpo alterado", () => {
    const signature = signMockWebhook(body, timestamp, secret);
    expect(verifyMockWebhook(`${body} `, signature, secret, timestamp + 30)).toBe(false);
  });

  it("rechaza timestamps con más de cinco minutos", () => {
    const signature = signMockWebhook(body, timestamp, secret);
    expect(verifyMockWebhook(body, signature, secret, timestamp + 301)).toBe(false);
  });

  it.each(["", "bad", "t=abc,v1=123", "t=1800000000,v2=abc"])("rechaza header malformado: %s", (signature) => {
    expect(verifyMockWebhook(body, signature, secret, timestamp)).toBe(false);
  });
});
