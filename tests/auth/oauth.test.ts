import { describe, expect, it } from "vitest";
import { getOAuthDestination, sanitizeInternalPath } from "@/features/auth/oauth";

describe("sanitizeInternalPath", () => {
  it("accepts a local TipMe path", () => {
    expect(sanitizeInternalPath("/dashboard/payouts")).toBe("/dashboard/payouts");
  });

  it("rejects absolute and protocol-relative destinations", () => {
    expect(sanitizeInternalPath("https://attacker.example")).toBe("/dashboard");
    expect(sanitizeInternalPath("//attacker.example")).toBe("/dashboard");
  });
});

describe("getOAuthDestination", () => {
  it("sends a new creator to onboarding", () => {
    expect(getOAuthDestination({ onboardingCompleted: false, requestedNext: "/dashboard" })).toBe("/onboarding");
  });

  it("sends a returning creator to the requested safe page", () => {
    expect(getOAuthDestination({ onboardingCompleted: true, requestedNext: "/dashboard/payouts" })).toBe("/dashboard/payouts");
  });

  it("does not send a returning creator back through onboarding", () => {
    expect(getOAuthDestination({ onboardingCompleted: true, requestedNext: "/onboarding" })).toBe("/dashboard");
  });
});
