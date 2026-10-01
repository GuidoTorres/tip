import { describe, expect, it } from "vitest";
import { getLegalDocuments } from "@/features/legal/content";

function documentText(locale: "es" | "en", document: "terms" | "privacy") {
  const value = getLegalDocuments(locale)[document];
  return [value.summary, ...value.sections.flatMap((section) => [section.title, ...section.paragraphs])].join(" ");
}

describe("TipMe legal model", () => {
  it("describes provider-neutral voluntary creator support", () => {
    const terms = documentText("es", "terms");

    expect(terms).not.toContain("Mercado Pago");
    expect(terms).toContain("proveedor de pagos activo");
    expect(terms).toContain("transferencias entre particulares");
    expect(terms).toContain("contenido o servicios para adultos");
    expect(terms).toContain("contenido permitido que el creador ya compartió");
    expect(terms).toContain("contenido adicional");
    expect(terms).toContain("interacciones privadas pagadas");
  });

  it("keeps the privacy disclosure neutral across payment providers", () => {
    const privacy = documentText("es", "privacy");

    expect(privacy).not.toContain("Mercado Pago");
    expect(privacy).toContain("proveedores de pago");
    expect(privacy).toContain("categoría de contenido");
    expect(privacy).toContain("aceptación de las reglas del creador");
  });
});
