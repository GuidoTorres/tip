import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApplicationCurrencyField } from "@/components/shared/application-currency-field";
import { parseProfileFormData } from "@/features/profiles/profile-input";

describe("USD como moneda operativa", () => {
  it("muestra USD sin permitir seleccionar otra moneda", () => {
    const html = renderToStaticMarkup(<ApplicationCurrencyField />);

    expect(html).toContain("USD");
    expect(html).not.toContain("<select");
    expect(html).not.toContain('name="currency"');
  });

  it("ignora una moneda manipulada y normaliza el perfil a USD", () => {
    const formData = new FormData();
    formData.set("publicName", "Alex");
    formData.set("username", "alex_live");
    formData.set("bio", "Contenido en vivo");
    formData.set("country", "CO");
    formData.set("locale", "es");
    formData.set("currency", "EUR");

    const result = parseProfileFormData(formData);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currency).toBe("USD");
  });
});
