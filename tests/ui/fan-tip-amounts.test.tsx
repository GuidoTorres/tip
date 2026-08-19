import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TipForm } from "@/components/tips/tip-form";

describe("fan tip amounts", () => {
  it("states USD once and keeps preset buttons free of currency symbols", () => {
    const html = renderToStaticMarkup(<TipForm username="camila" currency="USD" locale="es" />);

    expect(html).toContain("Todos los tips se procesan en dólares estadounidenses (USD).");
    for (const amount of [5, 10, 20, 50]) expect(html).toContain(`>${amount}</button>`);
    expect(html).not.toContain("5,00US$");
    expect(html).not.toContain("$5");
  });
});
