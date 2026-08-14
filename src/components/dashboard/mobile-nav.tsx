"use client";

import { Bell, GearSix, HandCoins, House } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isDashboardItemActive } from "./navigation-state";

const items = [
  { href: "/dashboard", label: "Inicio", icon: House },
  { href: "/dashboard/payouts", label: "Retiros", icon: HandCoins },
  { href: "/dashboard/notifications", label: "Avisos", icon: Bell },
  { href: "/dashboard/settings", label: "Ajustes", icon: GearSix },
];

export function MobileNav() {
  const pathname = usePathname();

  return <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-[max(0.75rem,env(safe-area-inset-left))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden" aria-label="Dashboard">{items.map(({ href, label, icon: Icon }) => {
    const active = isDashboardItemActive(pathname, href);
    return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-12 w-1/4 flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-semibold ${active ? "border-accent text-accent" : "border-transparent text-muted hover:text-accent"}`}><Icon size={21} weight="bold" />{label}</Link>;
  })}</nav>;
}

export function DesktopNav() {
  const pathname = usePathname();

  return <nav className="hidden items-center gap-1 md:flex" aria-label="Dashboard">{items.map(({ href, label }) => {
    const active = isDashboardItemActive(pathname, href);
    return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold ${active ? "border-accent text-accent" : "border-transparent text-muted hover:bg-surface-soft hover:text-foreground"}`}>{label}</Link>;
  })}</nav>;
}
