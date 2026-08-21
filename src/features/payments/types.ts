export const supportedCurrencies = ["USD", "EUR", "PEN", "COP", "MXN", "BRL", "CLP", "ARS"] as const;
export type Currency = (typeof supportedCurrencies)[number];

export const tipStatuses = ["created", "pending", "confirmed", "rejected", "refunded", "chargeback"] as const;
export type TipStatus = (typeof tipStatuses)[number];

export type LedgerEntryType =
  | "tip_confirmed"
  | "platform_fee"
  | "gateway_fee"
  | "payout"
  | "refund"
  | "chargeback"
  | "reserve_hold"
  | "reserve_release"
  | "adjustment_admin";
