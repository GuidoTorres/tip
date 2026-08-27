import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LegalFooter } from "@/components/shared/legal-footer";

describe("legal footer", () => {
  it("keeps the public legal documents reachable", () => {
    const html = renderToStaticMarkup(<LegalFooter locale="es" year={2026} />);

    expect(html).toContain("© 2026 TipMe. Todos los derechos reservados.");
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/refund-policy"');
  });

  it("uses the English labels when the site is in English", () => {
    const html = renderToStaticMarkup(<LegalFooter locale="en" year={2026} />);

    expect(html).toContain("All rights reserved.");
    expect(html).toContain(">Terms</a>");
    expect(html).toContain(">Privacy</a>");
    expect(html).toContain(">Refunds</a>");
  });
});
