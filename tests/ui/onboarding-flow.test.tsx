import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ paypalFlow: "platform_payouts" }));

vi.mock("next/navigation", () => ({ redirect: vi.fn(), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/env/public", () => ({
  getPublicEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://tipme.pro", NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-vapid-key" }),
}));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({
    PAYMENT_PROVIDER: "paypal",
    PAYPAL_FLOW: state.paypalFlow,
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "creator-1", email: "creator@example.com" } } }) },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: { public_name: "Camila", username: "camila", bio: null, social_url: "", content_category: null, locale: "es" } }),
        maybeSingle: async () => ({ data: null }),
      };
      return query;
    },
  }),
}));

import OnboardingPage from "@/app/onboarding/page";

describe("creator onboarding", () => {
  beforeEach(() => {
    state.paypalFlow = "platform_payouts";
  });

  it("creates the TipMe page in one step for PayPal platform payouts", async () => {
    const page = await OnboardingPage({ searchParams: Promise.resolve({ step: "1" }) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("1 de 1");
    expect(html).toContain("Crear mi página");
    expect(html).toContain('name="socialUrl"');
    expect(html).toContain('type="url"');
    expect(html).toContain('name="contentCategory"');
    expect(html).toContain('name="creatorPolicyAccepted"');
    expect(html).toContain("contenido permitido que ya compartiste");
    expect(html).not.toContain("Conecta tu correo PayPal");
  });

  it.each(["2", "3"])("keeps PayPal onboarding to the public-page step when old step %s is opened", async (requestedStep) => {
    const page = await OnboardingPage({ searchParams: Promise.resolve({ step: requestedStep }) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("1 de 1");
    expect(html).toContain("Tu pagina publica");
    expect(html).toContain("Crear mi p\u00e1gina");
    expect(html).not.toContain("Conecta tu correo PayPal");
    expect(html).not.toContain("Tu link esta listo");
  });
});
