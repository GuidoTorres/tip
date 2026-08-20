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
});
