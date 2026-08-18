import { describe, expect, it } from "vitest";
import { createOAuthState, verifyOAuthState } from "@/lib/security/oauth-state";

describe("OAuth state", () => {
  it("creates an unpredictable state and verifies only the same value", () => {
    const first = createOAuthState();
    const second = createOAuthState();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(32);
    expect(verifyOAuthState(first, first)).toBe(true);
    expect(verifyOAuthState(first, second)).toBe(false);
    expect(verifyOAuthState(first, "")).toBe(false);
  });
});
