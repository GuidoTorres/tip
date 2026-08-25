import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TipForm } from "@/components/tips/tip-form";

describe("fan legal consent", () => {
  // La aceptación pasó de casilla explícita a consentimiento por el acto de pagar.
  // El aviso debe seguir siendo visible, contundente y pegado al formulario de pago.
  it("leads with the non-refundable consequence next to payment", () => {
    const html = renderToStaticMarkup(<TipForm username="camila" currency="USD" locale="es" />);

    // Los enlaces van embebidos en la frase, así que el texto no es contiguo.
    expect(html).toContain("Los tips ");
    expect(html).toContain(">no son reembolsables</a>");
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
