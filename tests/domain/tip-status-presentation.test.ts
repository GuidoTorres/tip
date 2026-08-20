import { describe, expect, it } from "vitest";
import { getTipStatusPresentation } from "@/features/payments/tip-status-presentation";

describe("tip status presentation", () => {
  it.each([
    ["created", "Pendiente", "warning"],
    ["pending", "Pendiente", "warning"],
    ["confirmed", "Confirmado", "success"],
    ["rejected", "Rechazado", "danger"],
    ["refunded", "Reembolsado", "danger"],
    ["chargeback", "Contracargo", "danger"],
  ] as const)("presents %s without masking its financial state", (status, label, tone) => {
    expect(getTipStatusPresentation(status)).toEqual({ label, tone });
  });
});
