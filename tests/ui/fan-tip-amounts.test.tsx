import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TipForm } from "@/components/tips/tip-form";
import { getDictionary } from "@/lib/i18n";

describe("fan tip amounts", () => {
  it("states USD once and keeps preset buttons free of currency symbols", () => {
    const html = renderToStaticMarkup(<TipForm username="camila" currency="USD" locale="es" />);
    const notice = getDictionary("es").tip.currencyNotice;

    // La moneda se declara una sola vez, en el encabezado — no repetida en cada botón.
    expect(html).toContain(notice);
    expect(html.split(notice)).toHaveLength(2);
    for (const amount of [5, 10, 20, 50]) expect(html).toContain(`>${amount}</button>`);
    expect(html).not.toContain("5,00US$");
    expect(html).not.toContain("$5");
  });

  it("keeps every amount option in a single row", () => {
    const html = renderToStaticMarkup(<TipForm username="camila" currency="USD" locale="es" />);

    expect(html).toContain("grid-cols-5");
    expect(html).toContain(">Otro</button>");
  });
});
