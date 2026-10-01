import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";

const document = {
  title: "Documento legal",
  summary: "Resumen",
  sections: [],
};

describe("legal contact", () => {
  it("shows the TipMe support email when no operator email is configured", () => {
    const html = renderToStaticMarkup(
      <LegalDocumentPage
        document={document}
        operatorName=""
        contactEmail=""
        locale="es"
      />,
    );

    expect(html).toContain('href="mailto:soporte@tipme.pro"');
    expect(html).toContain(">soporte@tipme.pro</a>");
  });
});
