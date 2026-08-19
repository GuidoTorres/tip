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
  it("keeps notification activation beside the avatar without duplicate lower sections", async () => {
    const html = renderToStaticMarkup(await SettingsPage({ searchParams: Promise.resolve({}) }));
    const identityStart = html.indexOf('aria-label="Perfil y notificaciones"');
    const formStart = html.indexOf('aria-label="Datos del perfil"', identityStart);
    const identityMarkup = html.slice(identityStart, formStart);

    expect(identityStart).toBeGreaterThan(-1);
    expect(identityMarkup).toContain("justify-between");
    expect(identityMarkup).toContain('aria-label="Control de notificaciones"');
    expect(identityMarkup).toContain("ml-auto");
    expect(html.indexOf("Tu foto de perfil", identityStart)).toBeLessThan(formStart);
    expect(html.indexOf("Comprobando notificaciones", identityStart)).toBeLessThan(formStart);
    expect(html).not.toContain("Tu link");
    expect(html).not.toContain("Configurar notificaciones");
    expect(html).not.toContain('href="/dashboard/settings/notifications"');
  });
});
