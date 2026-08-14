import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { formatMoney } from "@/lib/i18n";
import type { Currency } from "@/features/payments/types";

export function BalanceSummary({ currency, availableMinor, pendingMinor }: { currency: Currency; availableMinor: number; pendingMinor: number }) {
  return <section className="rounded-2xl bg-foreground p-6 text-background shadow-[var(--shadow)] sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-sm opacity-70">Disponible</p><p className="mt-2 text-5xl font-semibold tracking-[-0.06em] sm:text-6xl">{formatMoney(availableMinor, currency, "es")}</p></div><span className="rounded-full border border-background/20 px-3 py-1 text-xs font-semibold">{currency}</span></div><div className="mt-7 flex items-end justify-between gap-4 border-t border-background/15 pt-5"><div><p className="text-xs opacity-65">Pendiente</p><p className="mt-1 text-xl font-semibold">{formatMoney(pendingMinor, currency, "es")}</p></div><Link href="/dashboard/payouts" className="pressable inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-5 font-bold text-on-accent">RETIRAR <ArrowUpRight size={18} weight="bold" /></Link></div></section>;
}

