import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardProfileHeader } from "@/components/dashboard/dashboard-profile-header";

describe("dashboard profile header", () => {
  it("shows the creator profile photo beside the greeting", () => {
    const html = renderToStaticMarkup(<DashboardProfileHeader name="Héctor Torres" avatarUrl="/avatar.jpg" />);

    expect(html).toContain('alt="Foto de perfil de Héctor Torres"');
    expect(html).toContain("Héctor Torres");
    expect(html).not.toContain('aria-label="Inicial de Héctor Torres"');
  });

  it("uses the first name initial when no photo is available", () => {
    const html = renderToStaticMarkup(<DashboardProfileHeader name="Héctor Torres" avatarUrl={null} />);

    expect(html).toContain('aria-label="Inicial de Héctor Torres"');
    expect(html).toContain(">H<");
    expect(html).not.toContain("<img");
  });
});
