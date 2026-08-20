import { describe, expect, it } from "vitest";
import { normalizeOperationCode } from "@/features/payments/operation-code";

describe("tip operation codes", () => {
  it("normalizes a copied operation code for an exact lookup", () => {
    expect(normalizeOperationCode(" tm 7a4f 91c2 d8b0 1234 ")).toBe("TM-7A4F-91C2-D8B0-1234");
  });

  it.each(["", "TM-1234", "TM-7A4F-91C2-D8B0-Z234", "OTHER-7A4F-91C2-D8B0-1234"])(
    "rejects an invalid operation code: %s",
    (value) => expect(normalizeOperationCode(value)).toBeNull(),
  );
});
