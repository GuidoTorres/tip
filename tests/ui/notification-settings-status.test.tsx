import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NotificationSettingsPage from "@/app/dashboard/settings/notifications/page";

describe("notification settings status", () => {
  it("does not claim push is active before checking the current device", () => {
    const html = renderToStaticMarkup(<NotificationSettingsPage />);

    expect(html).not.toContain(">ON<");
    expect(html).toContain("Comprobando notificaciones");
  });
});
