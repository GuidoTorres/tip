import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { formatMoney } from "@/lib/i18n";
import type { Currency } from "@/features/payments/types";

export function BalanceSummary({ currency, availableMinor, pendingMinor, todayMinor = 0, monthMinor = 0, paymentProvider = "mock", sandboxSingleMerchant = false, shareActions }: { currency: Currency; availableMinor: number; pendingMinor: number; todayMinor?: number; monthMinor?: number; paymentProvider?: "mock" | "paypal"; sandboxSingleMerchant?: boolean; shareActions?: ReactNode }) {
  const paypal = paymentProvider === "paypal";
  return <section className="rounded-2xl bg-foreground p-6 text-background shadow-[var(--shadow)] sm:p-8">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:gap-7">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm opacity-70">{sandboxSingleMerchant ? "Neto confirmado · Sandbox" : paypal ? "Neto confirmado" : "Disponible"}</p>
          <span className="rounded-full border border-background/20 px-2.5 py-1 text-[0.7rem] font-semibold">{currency}</span>
        </div>
        <p className="mt-3 text-4xl font-semibold tracking-[-0.04em] tabular-nums sm:text-6xl">{formatMoney(availableMinor, currency, "es")}</p>
      </div>
      <dl aria-label="Ingresos por periodo" className="min-w-[5.5rem] space-y-3 border-l border-background/15 pl-4 sm:min-w-32 sm:pl-6">
        <div><dt className="text-xs opacity-65">Hoy</dt><dd className="mt-1 text-sm font-semibold tabular-nums sm:text-lg">{formatMoney(todayMinor, currency, "es")}</dd></div>
        <div><dt className="text-xs opacity-65">Este mes</dt><dd className="mt-1 text-sm font-semibold tabular-nums sm:text-lg">{formatMoney(monthMinor, currency, "es")}</dd></div>
      </dl>
    </div>
    <div className="mt-7 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-4 border-t border-background/15 pt-5">
      <div><p className="text-xs opacity-65">Pendiente</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(pendingMinor, currency, "es")}</p></div>
      <div className="min-w-0">
        {shareActions}
        {!paypal && <Link href="/dashboard/payouts" className="pressable ml-auto mt-2 inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-5 font-bold text-on-accent">RETIRAR <ArrowUpRight size={18} weight="bold" /></Link>}
      </div>
    </div>
    {paypal && <p className="mt-4 text-xs leading-relaxed opacity-65">{sandboxSingleMerchant ? "Prueba: PayPal recibe el dinero en la cuenta Sandbox de TipMe; el saldo creador es una simulación del ledger." : "PayPal recibe y administra el dinero. TipMe muestra aquí los pagos confirmados."}</p>}
  </section>;
}
