import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ canAcceptTips: true }));

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: async () => "es" }));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({ PAYMENT_PROVIDER: "paypal" }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    rpc: () => ({
      maybeSingle: async () => ({
        data: {
          id: "creator-1",
          public_name: "Camila",
          username: "camila",
          avatar_url: null,
          bio: "Gracias por el apoyo",
          social_url: "https://www.tiktok.com/@camila",
          content_category: "livestreaming",
          can_accept_tips: state.canAcceptTips,
        },
        error: null,
      }),
    }),
  }),
}));

import CreatorPage from "@/app/[username]/page";

describe("public creator social profile", () => {
  beforeEach(() => {
    state.canAcceptTips = true;
  });

  it("lets a fan verify the creator on their public social profile", async () => {
    const html = renderToStaticMarkup(await CreatorPage({ params: Promise.resolve({ username: "camila" }) }));

    expect(html).toContain('href="https://www.tiktok.com/@camila"');
    expect(html).toContain("Ver perfil público en tiktok.com");
    expect(html).toContain('rel="noreferrer"');
  });

  it("lets anyone report the page without exposing private creator data", async () => {
    const html = renderToStaticMarkup(await CreatorPage({ params: Promise.resolve({ username: "camila" }) }));

    expect(html).toContain("Reportar esta página");
    expect(html).toContain("mailto:soporte@tipme.pro");
    expect(html).toContain("camila");
  });

  it("keeps a pending profile visible but does not let it receive tips", async () => {
    state.canAcceptTips = false;

    const html = renderToStaticMarkup(await CreatorPage({ params: Promise.resolve({ username: "camila" }) }));

    expect(html).toContain("Esta página está pendiente de revisión");
    expect(html).not.toContain("Enviar tip");
  });
});
