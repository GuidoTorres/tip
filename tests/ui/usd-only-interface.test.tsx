import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApplicationCurrencyField } from "@/components/shared/application-currency-field";
import { parseProfileFormData } from "@/features/profiles/profile-input";

describe("USD como moneda operativa", () => {
  it("explica que tips y saldos se procesan en USD sin mostrar un campo", () => {
    const html = renderToStaticMarkup(<ApplicationCurrencyField />);

    expect(html).toContain("Todos los tips y saldos se procesan en USD.");
    expect(html).not.toContain("<select");
    expect(html).not.toContain('name="currency"');
  });

  it("acepta el perfil sin pedir país ni moneda y lo normaliza a USD", () => {
    const formData = new FormData();
    formData.set("publicName", "Alex");
    formData.set("username", "alex_live");
    formData.set("bio", "Contenido en vivo");
    formData.set("locale", "es");

    const result = parseProfileFormData(formData);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currency).toBe("USD");
  });
});
