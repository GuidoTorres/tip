export function isDashboardItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href || pathname.startsWith("/dashboard/tips/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
