import type { TipStatus } from "./types";

const allowed: Record<TipStatus, readonly TipStatus[]> = {
  created: ["pending", "confirmed", "rejected"],
  pending: ["confirmed", "rejected"],
  confirmed: ["refunded", "chargeback"],
  rejected: [],
  refunded: [],
  chargeback: [],
};

export function canTransitionTip(from: TipStatus, to: TipStatus): boolean {
  return allowed[from].includes(to);
}
