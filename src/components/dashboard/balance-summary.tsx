import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Currency } from "@/features/payments/types";
import { formatMoney } from "@/lib/i18n";

type BalanceSummaryProps = {
  currency: Currency;
  availableMinor: number;
  pendingMinor: number;
  todayMinor?: number;
  monthMinor?: number;
  grossConfirmedMinor?: number;
  feesMinor?: number;
  paymentProvider?: "mock" | "paypal" | "mercadopago";
  sandboxSingleMerchant?: boolean;
  platformPayouts?: boolean;
  shareActions?: ReactNode;
  refreshAction?: ReactNode;
};

export function BalanceSummary({
  currency,
  availableMinor,
  todayMinor = 0,
  monthMinor = 0,
  grossConfirmedMinor = 0,
  feesMinor = 0,
  paymentProvider = "mock",
  sandboxSingleMerchant = false,
  platformPayouts = false,
  shareActions,
  refreshAction,
}: BalanceSummaryProps) {
  const paypal = paymentProvider === "paypal";
  const mercadoPago = paymentProvider === "mercadopago";

  if ((paypal && !platformPayouts) || mercadoPago) {
    return (
      <section className="relative rounded-2xl bg-foreground p-6 text-background shadow-[var(--shadow)] sm:p-8">
        {refreshAction && <div className="absolute right-5 top-5 sm:right-7 sm:top-7">{refreshAction}</div>}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 pr-12">
                <p className="text-sm opacity-70">
                  {sandboxSingleMerchant ? "Total confirmado · Sandbox" : "Total confirmado"}
                </p>
                <span className="rounded-full border border-background/20 px-2.5 py-1 text-[0.7rem] font-semibold">
                  {currency}
                </span>
              </div>
            </div>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.04em] tabular-nums sm:text-6xl">
              {formatMoney(grossConfirmedMinor, currency, "es")}
            </p>
          </div>
          {shareActions && <div className="min-w-0 pt-8 sm:max-w-[48%] sm:pt-1">{shareActions}</div>}
        </div>
        <dl aria-label="Resumen de tips confirmados" className="mt-7 grid grid-cols-3 divide-x divide-background/15 border-t border-background/15 pt-5">
          <div className="pr-3 sm:pr-6">
            <dt className="text-xs opacity-65">Hoy</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums sm:text-lg">{formatMoney(todayMinor, currency, "es")}</dd>
          </div>
          <div className="px-3 sm:px-6">
            <dt className="text-xs leading-tight opacity-65">Comisiones descontadas</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums sm:text-lg">{formatMoney(feesMinor, currency, "es")}</dd>
          </div>
          <div className="pl-3 sm:pl-6">
            <dt className="text-xs opacity-65">Total neto</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums sm:text-lg">{formatMoney(availableMinor, currency, "es")}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed opacity-65">
          {mercadoPago
            ? "Mercado Pago recibe y administra el dinero. TipMe muestra únicamente los pagos confirmados por webhook."
            : sandboxSingleMerchant
            ? "Prueba: PayPal recibe el dinero en la cuenta Sandbox de TipMe; el saldo del creador es una simulación del ledger."
            : "PayPal recibe y administra el dinero. TipMe muestra aquí únicamente los pagos confirmados."}
        </p>
      </section>
    );
  }

  return (
    <section className="relative rounded-2xl bg-foreground p-6 text-background shadow-[var(--shadow)] sm:p-8">
      {refreshAction && <div className="absolute right-5 top-5 sm:right-7 sm:top-7">{refreshAction}</div>}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 sm:gap-7">
        <div className="min-w-0">
          <div>
            <div className="flex flex-wrap items-center gap-2 pr-12">
              <p className="text-sm opacity-70">Disponible</p>
              <span className="rounded-full border border-background/20 px-2.5 py-1 text-[0.7rem] font-semibold">{currency}</span>
            </div>
          </div>
          <p className="mt-3 text-4xl font-semibold tracking-[-0.04em] tabular-nums sm:text-6xl">
            {formatMoney(availableMinor, currency, "es")}
          </p>
        </div>
        <dl aria-label="Ingresos por periodo" className="min-w-[5.5rem] space-y-3 border-l border-background/15 pl-4 sm:min-w-32 sm:pl-6">
          <div>
            <dt className="text-xs opacity-65">Hoy</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums sm:text-lg">{formatMoney(todayMinor, currency, "es")}</dd>
          </div>
          <div>
            <dt className="text-xs opacity-65">Este mes</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums sm:text-lg">{formatMoney(monthMinor, currency, "es")}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-7 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border-t border-background/15 pt-5">
        <Link href="/dashboard/payouts" className="pressable inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-5 font-bold text-on-accent">
          RETIRAR <ArrowUpRight size={18} weight="bold" />
        </Link>
        {shareActions && <div className="min-w-0">{shareActions}</div>}
      </div>
    </section>
  );
}
