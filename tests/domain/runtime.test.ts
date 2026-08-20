import { describe, expect, it } from "vitest";
import { mockSimulatorAllowed } from "@/lib/env/runtime";
import { getServerEnv } from "@/lib/env/server";

describe("mockSimulatorAllowed", () => {
  it("bloquea siempre el entorno Production de Vercel", () => {
    expect(mockSimulatorAllowed({ NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(false);
  });

  it("habilita desarrollo local y Vercel Preview", () => {
    expect(mockSimulatorAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(mockSimulatorAllowed({ NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe(true);
  });
});

describe("PayPal runtime configuration", () => {
  it("configura platform payouts y sus tarifas sin exponerlas como variables públicas", () => {
    const previous = { ...process.env };
    process.env.PAYPAL_FLOW = "platform_payouts";
    process.env.PAYPAL_PAYOUT_FEE_BPS = "200";
    process.env.PAYPAL_PAYOUT_FEE_CAP_MINOR = "100";
    process.env.PAYPAL_CHECKOUT_FEE_BPS = "540";
    process.env.PAYPAL_CHECKOUT_FIXED_FEE_MINOR = "30";
    process.env.PAYOUT_HOLD_MINUTES = "0";
    try {
      const env = getServerEnv();
      expect(env.PAYPAL_FLOW).toBe("platform_payouts");
      expect(env.PAYPAL_PAYOUT_FEE_BPS).toBe(200);
      expect(env.PAYPAL_PAYOUT_FEE_CAP_MINOR).toBe(100);
      expect(env.PAYPAL_CHECKOUT_FEE_BPS).toBe(540);
      expect(env.PAYPAL_CHECKOUT_FIXED_FEE_MINOR).toBe(30);
      expect(env.PAYOUT_HOLD_MINUTES).toBe(0);
    } finally {
      process.env = previous;
    }
  });

  it("accepts PayPal sandbox and keeps receipt authorization independent from mock webhooks", () => {
    const previous = { ...process.env };
    process.env.PAYMENT_PROVIDER = "paypal";
    process.env.PAYPAL_ENVIRONMENT = "sandbox";
    process.env.RECEIPT_SIGNING_SECRET = "receipt-secret-at-least-16";
    try {
      const env = getServerEnv();
      expect(env.PAYMENT_PROVIDER).toBe("paypal");
      expect(env.PAYPAL_ENVIRONMENT).toBe("sandbox");
      expect(env.RECEIPT_SIGNING_SECRET).toBe("receipt-secret-at-least-16");
    } finally {
      process.env = previous;
    }
  });

  it("allows single-merchant checkout only in Sandbox without a BN code", () => {
    const previous = { ...process.env };
    process.env.PAYMENT_PROVIDER = "paypal";
    process.env.PAYPAL_ENVIRONMENT = "sandbox";
    process.env.PAYPAL_SANDBOX_SINGLE_MERCHANT = "true";
    delete process.env.PAYPAL_PARTNER_ATTRIBUTION_ID;
    try {
      const env = getServerEnv();
      expect(env.PAYPAL_SANDBOX_SINGLE_MERCHANT).toBe(true);
      expect(env.PAYPAL_PARTNER_ATTRIBUTION_ID).toBe("");
    } finally {
      process.env = previous;
    }
  });

  it("rejects the single-merchant fallback in live mode", () => {
    const previous = { ...process.env };
    process.env.PAYMENT_PROVIDER = "paypal";
    process.env.PAYPAL_ENVIRONMENT = "live";
    process.env.PAYPAL_SANDBOX_SINGLE_MERCHANT = "true";
    try {
      expect(() => getServerEnv()).toThrow();
    } finally {
      process.env = previous;
    }
  });
});
