import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TipForm } from "@/components/tips/tip-form";

describe("fan legal consent", () => {
  // La aceptación pasó de casilla explícita a consentimiento por el acto de pagar.
  // El aviso debe seguir siendo visible, contundente y pegado al formulario de pago.
  it("explains the voluntary nature and refund limits next to payment", () => {
    const html = renderToStaticMarkup(<TipForm username="camila" currency="USD" locale="es" />);

    expect(html).toContain("Este tip es un apoyo voluntario");
    expect(html).toContain("agradece contenido que esta creadora ya compartió");
    expect(html).toContain("No compra contenido adicional, acceso ni garantiza una respuesta");
    expect(html).toContain(">generalmente no son reembolsables</a>");
    expect(html).toContain("antes de pagar");
  });

  it("links both legal documents from the payment notice", () => {
    const html = renderToStaticMarkup(<TipForm username="camila" currency="USD" locale="es" />);

    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/refund-policy"');
  });

  it("no longer gates the tip behind a separate checkbox", () => {
    const html = renderToStaticMarkup(<TipForm username="camila" currency="USD" locale="es" />);

    expect(html).not.toContain('name="legalAccepted"');
  });
});
