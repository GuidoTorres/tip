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

