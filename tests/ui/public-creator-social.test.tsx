import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ review: undefined as string | undefined, destination: true }));

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: async () => "es" }));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({ PAYMENT_PROVIDER: "paypal", PAYPAL_FLOW: "platform_payouts" }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    from: (table: string) => {
      const query = {
      select: () => query,
      eq: () => query,
      in: () => query,
      order: () => query,
      limit: () => query,
      maybeSingle: async () => ({
        data: table === "payout_accounts" ? (state.destination ? { id: "destination-1", status: "pending" } : null) : {
          id: "creator-1",
          public_name: "Camila",
          username: "camila",
          avatar_url: null,
          bio: "Gracias por el apoyo",
          social_url: "https://www.tiktok.com/@camila",
          content_category: "livestreaming",
          onboarding_completed: true,
          payment_review_status: state.review,
          preferred_currency: "USD",
        },
        error: null,
      }),
      };
      return query;
    },
  }),
}));

import CreatorPage from "@/app/[username]/page";

describe("public creator social profile", () => {
  beforeEach(() => {
    state.review = undefined;
    state.destination = true;
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

  it.each(["rejected", "suspended"])("does not let a %s profile receive tips", async (review) => {
    state.review = review;

    const html = renderToStaticMarkup(await CreatorPage({ params: Promise.resolve({ username: "camila" }) }));

    expect(html).toContain("Esta página todavía no acepta tips");
    expect(html).not.toContain("Añadir nombre o mensaje");
  });
  it.each([undefined, "pending", "approved"])("shows checkout with a saved pending email and review %s", async (review) => {
    state.review = review;
    const html = renderToStaticMarkup(await CreatorPage({ params: Promise.resolve({ username: "camila" }) }));
    expect(html).toContain("Añadir nombre o mensaje");
    expect(html).not.toContain("pendiente de revisión");
  });
  it("does not offer checkout until a payout email has been saved", async () => {
    state.destination = false;
    const html = renderToStaticMarkup(await CreatorPage({ params: Promise.resolve({ username: "camila" }) }));
    expect(html).toContain("Esta página todavía no acepta tips");
    expect(html).not.toContain("Añadir nombre o mensaje");
  });
});
