import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/lib/env/public", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_APP_URL: "https://tipme.pro",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-vapid-key",
  }),
}));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({
    PAYMENT_PROVIDER: "paypal",
    PAYPAL_FLOW: "platform_payouts",
    PAYPAL_SANDBOX_SINGLE_MERCHANT: false,
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "creator-1", email: "creator@example.com" } } }) },
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        single: async () => ({ data: { public_name: "Camila", username: "camila", bio: null, locale: "es" } }),
        maybeSingle: async () => ({
          data: table === "payout_accounts"
            ? { provider_account_id: "creator@example.com", status: "pending" }
            : null,
        }),
      };
      return query;
    },
  }),
}));

import OnboardingPage from "@/app/onboarding/page";

describe("creator onboarding", () => {
  it("finishes in step three without requesting push permissions", async () => {
    const page = await OnboardingPage({ searchParams: Promise.resolve({ step: "3" }) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("3 de 3");
    expect(html).toContain("Tu link está listo");
    expect(html).toContain("Ir a mi dashboard");
    expect(html).not.toContain("Activar notificaciones");
    expect(html).not.toContain("No te pierdas ningún tip");
  });
});
