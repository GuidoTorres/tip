import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TipForm } from "@/components/tips/tip-form";

describe("fan legal consent", () => {
  it("requires conspicuous acceptance next to the tip action", () => {
    const html = renderToStaticMarkup(<TipForm username="camila" currency="USD" locale="es" />);

    expect(html).toContain('name="legalAccepted"');
    expect(html).toContain("required");
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/refund-policy"');
    expect(html).toContain("apoyo voluntario");
  });
});
