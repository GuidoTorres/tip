import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CreatorShareCard } from "@/components/dashboard/creator-share-card";
import { CreatorQr } from "@/components/dashboard/creator-qr";

describe("CreatorShareCard", () => {
  it("presents the public URL, clipboard and QR in one compact row", () => {
    const html = renderToStaticMarkup(<CreatorShareCard publicUrl="https://tipme.pro/camila" username="camila" />);

    expect(html).toContain("tipme.pro/camila");
    expect(html).not.toContain("Código QR");
    expect(html).toContain('aria-label="Copiar link"');
    expect(html).toContain('aria-label="Mostrar QR"');
  });

  it("does not repeat the copy-link action inside the QR modal", () => {
    const html = renderToStaticMarkup(<CreatorQr publicUrl="https://tipme.pro/camila" username="camila" iconOnly />);

    expect(html).not.toContain("Copiar link");
    expect(html).not.toContain("Muéstralo en tu live");
  });

  it("keeps the QR modal free of vertical scrolling", () => {
    const html = renderToStaticMarkup(<CreatorQr publicUrl="https://tipme.pro/camila" username="camila" iconOnly />);

    expect(html).not.toContain("overflow-y-auto");
    expect(html).toContain("overflow-hidden");
    expect(html).toContain("42dvh");
  });
});
