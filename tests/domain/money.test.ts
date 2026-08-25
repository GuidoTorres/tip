import { describe, expect, it } from "vitest";
import {
  calculateTipBreakdown,
  sumLedger,
} from "@/features/ledger/money";

describe("calculateTipBreakdown", () => {
  it("calcula 300 basis points sin usar decimales monetarios", () => {
    expect(calculateTipBreakdown({ amountMinor: 2_000, platformFeeBps: 300, gatewayFeeMinor: null })).toEqual({
      amountMinor: 2_000,
      platformFeeMinor: 60,
      gatewayFeeMinor: null,
      netAmountMinor: 1_940,
      feeStatus: "provisional",
    });
  });

  it("descuenta el fee exacto reportado por el gateway", () => {
    expect(calculateTipBreakdown({ amountMinor: 2_000, platformFeeBps: 300, gatewayFeeMinor: 80 }).netAmountMinor).toBe(1_860);
  });

  it.each([0, -1, 10.5, Number.MAX_SAFE_INTEGER + 1])("rechaza montos inseguros: %s", (amountMinor) => {
    expect(() => calculateTipBreakdown({ amountMinor, platformFeeBps: 300, gatewayFeeMinor: null })).toThrow();
  });
});

describe("sumLedger", () => {
  it("reconstruye disponible y pendiente desde movimientos con signo", () => {
    const result = sumLedger([
      { type: "tip_confirmed", amountMinor: 2_000, currency: "USD" },
      { type: "platform_fee", amountMinor: -60, currency: "USD" },
      { type: "gateway_fee", amountMinor: -80, currency: "USD" },
      { type: "payout", amountMinor: -500, currency: "USD" },
      { type: "reserve_hold", amountMinor: -200, currency: "USD" },
    ], "USD");

    expect(result).toEqual({ availableMinor: 1_160, pendingMinor: 200 });
  });

  it("rechaza mezclar monedas", () => {
    expect(() => sumLedger([{ type: "tip_confirmed", amountMinor: 100, currency: "EUR" }], "USD")).toThrow("currency");
  });
});
