import { describe, expect, it } from "vitest";
import { calculateTipBreakdown, sumLedger, sumWithdrawnByCurrency } from "@/features/ledger/money";

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

describe("sumWithdrawnByCurrency", () => {
  it("suma retiros completados por moneda y devuelve importes positivos", () => {
    expect(sumWithdrawnByCurrency([
      { amountMinor: -1_000, currency: "USD" },
      { amountMinor: -500, currency: "USD" },
      { amountMinor: -2_000, currency: "PEN" },
    ])).toEqual({ USD: 1_500, PEN: 2_000 });
  });

  it("devuelve un total vacío cuando aún no existen retiros", () => {
    expect(sumWithdrawnByCurrency([])).toEqual({});
  });

  it("rechaza movimientos de payout que no sean débitos", () => {
    expect(() => sumWithdrawnByCurrency([
      { amountMinor: 100, currency: "USD" },
    ])).toThrow("payout ledger amount must be negative");
  });
});
