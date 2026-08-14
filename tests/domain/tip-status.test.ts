import { describe, expect, it } from "vitest";
import { canTransitionTip } from "@/features/payments/status";

describe("canTransitionTip", () => {
  it.each([
    ["created", "pending"], ["created", "confirmed"], ["created", "rejected"],
    ["pending", "confirmed"], ["pending", "rejected"],
    ["confirmed", "refunded"], ["confirmed", "chargeback"],
  ] as const)("permite %s -> %s", (from, to) => expect(canTransitionTip(from, to)).toBe(true));

  it.each([
    ["rejected", "confirmed"], ["refunded", "confirmed"], ["chargeback", "confirmed"], ["confirmed", "pending"],
  ] as const)("impide %s -> %s", (from, to) => expect(canTransitionTip(from, to)).toBe(false));
});
