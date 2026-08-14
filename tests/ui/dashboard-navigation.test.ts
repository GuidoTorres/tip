import { describe, expect, it } from "vitest";
import { isDashboardItemActive } from "@/components/dashboard/navigation-state";

describe("isDashboardItemActive", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard/tips/tip-1", "/dashboard"],
    ["/dashboard/payouts", "/dashboard/payouts"],
    ["/dashboard/settings/notifications", "/dashboard/settings"],
    ["/dashboard/notifications", "/dashboard/notifications"],
  ])("activa %s dentro de la opción %s", (pathname, href) => {
    expect(isDashboardItemActive(pathname, href)).toBe(true);
  });

  it.each([
    ["/dashboard/payouts", "/dashboard"],
    ["/dashboard/settings", "/dashboard/notifications"],
    ["/dashboard/settings-old", "/dashboard/settings"],
  ])("no activa %s dentro de la opción %s", (pathname, href) => {
    expect(isDashboardItemActive(pathname, href)).toBe(false);
  });
});
