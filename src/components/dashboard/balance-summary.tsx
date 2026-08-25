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
  paymentProvider?: "mock" | "mercadopago";
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
  shareActions,
  refreshAction,
}: BalanceSummaryProps) {
  const mercadoPago = paymentProvider === "mercadopago";

  if (mercadoPago) {
    return (
      <section className="rounded-2xl bg-foreground p-6 text-background shadow-[var(--shadow)] sm:p-8">
        {/* Una columna en móvil; en escritorio el dinero queda a la izquierda y
            compartir a la derecha, para no dejar un vacío en el centro. */}
        <div className="sm:flex sm:items-start sm:justify-between sm:gap-10">
          <div className="min-w-0 sm:flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm opacity-70">Recibido en Mercado Pago</p>
              <span className="rounded-full border border-background/20 px-2.5 py-1 text-[0.7rem] font-semibold">
                {currency}
              </span>
              {refreshAction && <div className="ml-auto sm:hidden">{refreshAction}</div>}
            </div>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.04em] tabular-nums sm:text-6xl">
              {formatMoney(availableMinor, currency, "es")}
            </p>
            {grossConfirmedMinor > 0 && (
              <p className="mt-1.5 text-sm opacity-65">
                De {formatMoney(grossConfirmedMinor, currency, "es")}
                {feesMinor > 0 && <> · {formatMoney(feesMinor, currency, "es")} en comisiones</>}
              </p>
            )}
            <dl aria-label="Tips confirmados por periodo" className="mt-5 grid max-w-sm grid-cols-2 divide-x divide-background/15 border-t border-background/15 pt-4">
              <div className="pr-4 sm:pr-6">
                <dt className="text-xs opacity-65">Hoy</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums sm:text-lg">{formatMoney(todayMinor, currency, "es")}</dd>
              </div>
              <div className="pl-4 sm:pl-6">
                <dt className="text-xs opacity-65">Este mes</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums sm:text-lg">{formatMoney(monthMinor, currency, "es")}</dd>
              </div>
            </dl>
          </div>
          <div className="hidden shrink-0 sm:flex sm:items-center sm:gap-3">
            {shareActions}
            {refreshAction}
          </div>
        </div>
        {shareActions && <div className="mt-4 border-t border-background/15 pt-4 sm:hidden">{shareActions}</div>}
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
      {shareActions && <div className="mt-7 border-t border-background/15 pt-5"><div className="min-w-0">{shareActions}</div></div>}
    </section>
  );
}
