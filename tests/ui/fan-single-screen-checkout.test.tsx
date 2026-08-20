import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TipForm } from "@/components/tips/tip-form";

describe("fan single-screen checkout", () => {
  it("keeps identity optional without a separate anonymous control", () => {
    const html = renderToStaticMarkup(<TipForm username="camila" currency="USD" locale="es" />);

    expect(html).toContain('name="payerName"');
    expect(html).not.toContain("Enviar anónimamente");
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
  });

  it("uses a compact message field and no preliminary send action", () => {
    const html = renderToStaticMarkup(<TipForm username="camila" currency="USD" locale="es" />);

    expect(html).toContain('name="message"');
    expect(html).toContain('rows="2"');
    expect(html).toContain("min-h-16");
    expect(html).not.toContain("Preparando pago</button>");
  });
});
