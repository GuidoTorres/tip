import { describe, expect, it } from "vitest";
import { isDashboardItemActive } from "@/components/dashboard/navigation-state";
import { getDashboardNavigationItems } from "@/components/dashboard/mobile-nav";

describe("isDashboardItemActive", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard/tips", "/dashboard/tips"],
    ["/dashboard/tips/tip-1", "/dashboard/tips"],
    ["/dashboard/payouts", "/dashboard/payouts"],
    ["/dashboard/settings/notifications", "/dashboard/settings"],
    ["/dashboard/notifications", "/dashboard/notifications"],
  ])("activa %s dentro de la opción %s", (pathname, href) => {
    expect(isDashboardItemActive(pathname, href)).toBe(true);
  });

  it.each([
    ["/dashboard/payouts", "/dashboard"],
    ["/dashboard/tips/tip-1", "/dashboard"],
    ["/dashboard/settings", "/dashboard/notifications"],
    ["/dashboard/settings-old", "/dashboard/settings"],
  ])("no activa %s dentro de la opción %s", (pathname, href) => {
    expect(isDashboardItemActive(pathname, href)).toBe(false);
  });
});

describe("dashboard navigation", () => {
  it("ofrece retiros para el flujo PayPal con saldo administrado por TipMe", () => {
    const labels = getDashboardNavigationItems().map((item) => item.label);
    expect(labels).toEqual(["Inicio", "Tips", "Retiros", "Ajustes"]);
  });
});
