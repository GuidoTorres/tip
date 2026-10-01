import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";

const { getRequestLocale } = vi.hoisted(() => ({
  getRequestLocale: vi.fn(),
}));

vi.mock("@/lib/i18n/server", () => ({ getRequestLocale }));

async function renderHomePage() {
  return renderToStaticMarkup(
    await HomePage({ searchParams: Promise.resolve({}) }),
  );
}

describe("landing positioning", () => {
  beforeEach(() => {
    getRequestLocale.mockReset();
  });

  it("explains in Spanish that fans tip without coins or balance top-ups", async () => {
    getRequestLocale.mockResolvedValue("es");

    const html = await renderHomePage();
    expect(html).toContain("Sin monedas. Sin recargas. Solo tips.");
    expect(html).not.toContain("El dinero llega directo a tu cuenta.");
  });

  it("shows the equivalent positioning in English", async () => {
    getRequestLocale.mockResolvedValue("en");

    const html = await renderHomePage();
    expect(html).toContain("No coins. No top-ups. Just tips.");
    expect(html).not.toContain("Money lands straight in your account.");
  });

  it("connects tips to content already shared on external platforms", async () => {
    getRequestLocale.mockResolvedValue("es");

    const html = await renderHomePage();
    expect(html).toContain("contenido que ya disfrutas");
    expect(html).toContain("lives y redes");
    expect(html).not.toContain("desbloquea contenido");
  });

  it("does not make a regional availability claim", async () => {
    getRequestLocale.mockResolvedValue("es");

    expect(await renderHomePage()).not.toContain("Disponible en Latinoamérica");
  });
});
