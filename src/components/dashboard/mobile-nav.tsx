"use client";

import { Bank, GearSix, Heart, House } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isDashboardItemActive } from "./navigation-state";

const items = [
  { href: "/dashboard", label: "Inicio", icon: House },
  { href: "/dashboard/tips", label: "Tips", icon: Heart },
  { href: "/dashboard/payouts", label: "Retiros", icon: Bank },
  { href: "/dashboard/settings", label: "Ajustes", icon: GearSix },
];

export function getDashboardNavigationItems() {
  return items;
}

export function MobileNav() {
  const pathname = usePathname();

  return <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-surface/95 px-[max(0.5rem,env(safe-area-inset-left))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden" aria-label="Dashboard">{items.map(({ href, label, icon: Icon }) => {
    const active = isDashboardItemActive(pathname, href);
    return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-semibold ${active ? "border-accent text-accent-strong" : "border-transparent text-muted hover:text-accent-strong"}`}><Icon size={21} weight="bold" />{label}</Link>;
  })}</nav>;
}

export function DesktopNav() {
  const pathname = usePathname();

  return <nav className="hidden items-center gap-1 md:flex" aria-label="Dashboard">{items.map(({ href, label }) => {
    const active = isDashboardItemActive(pathname, href);
    return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold ${active ? "border-accent text-accent-strong" : "border-transparent text-muted hover:bg-surface-soft hover:text-foreground"}`}>{label}</Link>;
  })}</nav>;
}
