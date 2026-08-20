export type TipAmountRow = {
  amount_minor: number;
  base_amount_minor?: number | null;
};

export function creatorVisibleTipAmount(row: TipAmountRow): number {
  return Number(row.base_amount_minor ?? row.amount_minor);
}
