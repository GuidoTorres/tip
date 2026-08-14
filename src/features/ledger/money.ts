import type { Currency, LedgerEntryType } from "@/features/payments/types";

type BreakdownInput = {
  amountMinor: number;
  platformFeeBps: number;
  gatewayFeeMinor: number | null;
};

export type TipBreakdown = {
  amountMinor: number;
  platformFeeMinor: number;
  gatewayFeeMinor: number | null;
  netAmountMinor: number;
  feeStatus: "exact" | "provisional";
};

function assertSafeInteger(value: number, name: string, allowZero = true): void {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`${name} must be a safe positive integer`);
  }
}

export function calculateTipBreakdown(input: BreakdownInput): TipBreakdown {
  assertSafeInteger(input.amountMinor, "amountMinor", false);
  assertSafeInteger(input.platformFeeBps, "platformFeeBps");
  if (input.platformFeeBps > 10_000) throw new Error("platformFeeBps must not exceed 10000");
  if (input.gatewayFeeMinor !== null) assertSafeInteger(input.gatewayFeeMinor, "gatewayFeeMinor");

  const platformFeeMinor = Math.floor((input.amountMinor * input.platformFeeBps) / 10_000);
  const gatewayFee = input.gatewayFeeMinor ?? 0;
  const netAmountMinor = input.amountMinor - platformFeeMinor - gatewayFee;
  if (netAmountMinor < 0) throw new Error("fees must not exceed amountMinor");

  return {
    amountMinor: input.amountMinor,
    platformFeeMinor,
    gatewayFeeMinor: input.gatewayFeeMinor,
    netAmountMinor,
    feeStatus: input.gatewayFeeMinor === null ? "provisional" : "exact",
  };
}

export type LedgerProjection = {
  type: LedgerEntryType;
  amountMinor: number;
  currency: string;
};

export type BalanceSummary = { availableMinor: number; pendingMinor: number };

export type PayoutLedgerMovement = {
  amountMinor: number;
  currency: Currency;
};

export function sumLedger(entries: LedgerProjection[], currency: Currency): BalanceSummary {
  let availableMinor = 0;
  let pendingMinor = 0;

  for (const entry of entries) {
    if (entry.currency !== currency) throw new Error("currency mismatch in ledger projection");
    if (!Number.isSafeInteger(entry.amountMinor)) throw new Error("ledger amount must be a safe integer");
    availableMinor += entry.amountMinor;
    if (entry.type === "reserve_hold") pendingMinor += Math.abs(entry.amountMinor);
    if (entry.type === "reserve_release") pendingMinor -= Math.abs(entry.amountMinor);
  }

  return { availableMinor, pendingMinor: Math.max(0, pendingMinor) };
}

export function sumWithdrawnByCurrency(
  entries: PayoutLedgerMovement[],
): Partial<Record<Currency, number>> {
  const totals: Partial<Record<Currency, number>> = {};

  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.amountMinor) || entry.amountMinor >= 0) {
      throw new Error("payout ledger amount must be negative");
    }

    const total = (totals[entry.currency] ?? 0) + Math.abs(entry.amountMinor);
    if (!Number.isSafeInteger(total)) {
      throw new Error("withdrawn total must be a safe integer");
    }
    totals[entry.currency] = total;
  }

  return totals;
}
