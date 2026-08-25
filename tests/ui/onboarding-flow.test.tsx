import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn(), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/env/public", () => ({
  getPublicEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://tipme.pro", NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-vapid-key" }),
}));
vi.mock("@/lib/env/server", () => ({ getServerEnv: () => ({ PAYMENT_PROVIDER: "whop", WHOP_APP_ID: "app_test" }) }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "creator-1", email: "creator@example.com" } } }) },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: { public_name: "Camila", username: "camila", bio: null, locale: "es" } }),
        maybeSingle: async () => ({ data: null }),
      };
      return query;
    },
  }),
}));

import OnboardingPage from "@/app/onboarding/page";

describe("creator onboarding", () => {
  it("creates the TipMe page in one step without requiring Whop", async () => {
    const page = await OnboardingPage({ searchParams: Promise.resolve({ step: "1" }) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("1 de 1");
    expect(html).toContain("Crear mi página");
    expect(html).not.toContain("Conecta Whop");
  });
});
