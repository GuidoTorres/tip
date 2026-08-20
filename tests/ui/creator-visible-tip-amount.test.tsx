import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TipList, type RecentTip } from "@/components/dashboard/recent-tips";

describe("creator-visible tip amount", () => {
  it("shows the selected tip amount without the fan's processing support", () => {
    const tips = [{
      id: "tip-1",
      payer_name: "Mateo",
      message: null,
      anonymous: false,
      base_amount_minor: 2000,
      amount_minor: 2146,
      currency: "USD",
      status: "confirmed",
      created_at: "2026-08-20T20:00:00.000Z",
    }] as RecentTip[];

    const html = renderToStaticMarkup(<TipList tips={tips} />);

    expect(html).toContain("20,00");
    expect(html).not.toContain("21,46");
  });

  it("shows the searchable operation code and the real reversed status", () => {
    const tips = [{
      id: "tip-2",
      payer_name: "Mateo",
      message: null,
      anonymous: false,
      operation_code: "TM-7A4F-91C2-D8B0-1234",
      base_amount_minor: 2000,
      amount_minor: 2000,
      currency: "USD",
      status: "refunded",
      created_at: "2026-08-20T20:00:00.000Z",
    }] as RecentTip[];

    const html = renderToStaticMarkup(<TipList tips={tips} showOperationCode />);

    expect(html).toContain("TM-7A4F-91C2-D8B0-1234");
    expect(html).toContain("Reembolsado");
    expect(html).not.toContain("Pendiente");
  });
});
