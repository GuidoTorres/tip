import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/env/public", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_APP_URL: "https://tipme.pro",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test-public-key",
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "creator-1" } } }) },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({
          data: {
            public_name: "Camila",
            username: "camila",
            avatar_url: "https://example.com/avatar.jpg",
            bio: "Gracias por apoyar mi contenido",
            locale: "es",
          },
        }),
      };
      return query;
    },
  }),
}));
vi.mock("@/features/profiles/actions", () => ({
  deleteAvatar: vi.fn(),
  updateSettings: vi.fn(),
}));

import SettingsPage from "@/app/dashboard/settings/page";

describe("settings layout", () => {
  it("keeps profile settings focused after moving notification activation to the header", async () => {
    const html = renderToStaticMarkup(await SettingsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('aria-label="Perfil"');
    expect(html).toContain('aria-label="Datos del perfil"');
    expect(html).not.toContain('aria-label="Control de notificaciones"');
    expect(html).not.toContain("Comprobando notificaciones");
    expect(html).not.toContain("Tu link");
    expect(html).not.toContain("Configurar notificaciones");
    expect(html).not.toContain('href="/dashboard/settings/notifications"');
  });
});
