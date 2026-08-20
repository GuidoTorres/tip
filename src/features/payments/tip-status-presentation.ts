import type { TipStatus } from "./types";

export type TipStatusTone = "success" | "warning" | "danger";

export function getTipStatusPresentation(status: TipStatus): { label: string; tone: TipStatusTone } {
  switch (status) {
    case "confirmed": return { label: "Confirmado", tone: "success" };
    case "rejected": return { label: "Rechazado", tone: "danger" };
    case "refunded": return { label: "Reembolsado", tone: "danger" };
    case "chargeback": return { label: "Contracargo", tone: "danger" };
    case "created":
    case "pending": return { label: "Pendiente", tone: "warning" };
  }
}
