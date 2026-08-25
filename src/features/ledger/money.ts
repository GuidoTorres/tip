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

function assertFeeBps(value: number, allowFullRate = true): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > (allowFullRate ? 10_000 : 9_999)) {
    throw new Error("invalid_money");
  }
}

export function calculateProcessingSupportMinor(baseAmountMinor: number, feeBps: number, fixedFeeMinor: number): number {
  if (!Number.isSafeInteger(baseAmountMinor) || baseAmountMinor <= 0 || !Number.isSafeInteger(fixedFeeMinor) || fixedFeeMinor < 0) {
    throw new Error("invalid_money");
  }
  assertFeeBps(feeBps, false);
  const numerator = (baseAmountMinor + fixedFeeMinor) * 10_000;
  if (!Number.isSafeInteger(numerator)) throw new Error("invalid_money");
  const grossAmountMinor = Math.ceil(numerator / (10_000 - feeBps));
  if (!Number.isSafeInteger(grossAmountMinor)) throw new Error("invalid_money");
  return grossAmountMinor - baseAmountMinor;
}

function estimatedPayoutFeeMinor(recipientAmountMinor: number, feeBps: number, feeCapMinor: number): number {
  const numerator = recipientAmountMinor * feeBps;
  if (!Number.isSafeInteger(numerator)) throw new Error("invalid_money");
  return Math.min(Math.ceil(numerator / 10_000), feeCapMinor);
}

export function quotePayoutFromDebit(totalDebitMinor: number, feeBps: number, feeCapMinor: number) {
  if (!Number.isSafeInteger(totalDebitMinor) || totalDebitMinor <= 0 || !Number.isSafeInteger(feeCapMinor) || feeCapMinor < 0) {
    throw new Error("invalid_money");
  }
  assertFeeBps(feeBps);

  let low = 0;
  let high = totalDebitMinor;
  while (low < high) {
    const candidate = Math.ceil((low + high) / 2);
    const fee = estimatedPayoutFeeMinor(candidate, feeBps, feeCapMinor);
    if (candidate + fee <= totalDebitMinor) low = candidate;
    else high = candidate - 1;
  }
  if (low <= 0) throw new Error("invalid_money");
  return {
    totalDebitMinor,
    recipientAmountMinor: low,
    estimatedFeeMinor: totalDebitMinor - low,
  };
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
