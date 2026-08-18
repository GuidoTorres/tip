import { ArrowSquareOut, CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { formatMoney } from "@/lib/i18n";
import type { Currency } from "@/features/payments/types";

export function PayPalFundsPanel({ netConfirmedMinor, pendingMinor, currency, connected, sandboxSingleMerchant = false }: {
  netConfirmedMinor: number;
  pendingMinor: number;
  currency: Currency;
  connected: boolean;
  sandboxSingleMerchant?: boolean;
}) {
  return <section className="mt-7 rounded-2xl border border-border bg-surface p-6">
    <p className="text-sm text-muted">Neto confirmado por TipMe</p>
    <p className="mt-2 text-5xl font-semibold tracking-[-0.06em]">{formatMoney(netConfirmedMinor, currency, "es")}</p>
    <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm"><span className="text-muted">Pendiente de confirmación</span><strong>{formatMoney(pendingMinor, currency, "es")}</strong></div>
    <div className="mt-5 flex gap-3 rounded-xl bg-surface-soft p-4">{connected ? <CheckCircle className="shrink-0 text-success" size={22} weight="fill" /> : <WarningCircle className="shrink-0 text-warning" size={22} weight="fill" />}<div><p className="font-semibold">{sandboxSingleMerchant ? "Cuenta de prueba de TipMe" : connected ? "Cuenta PayPal conectada" : "Falta conectar PayPal"}</p><p className="mt-1 text-sm leading-relaxed text-muted">{sandboxSingleMerchant ? "El valor mostrado simula cuánto correspondería a la persona creadora. No es un saldo retirable por la persona creadora." : "El dinero llega a tu cuenta PayPal. La disponibilidad y el retiro hacia tu banco los administra PayPal."}</p></div></div>
    <a href={sandboxSingleMerchant ? "https://www.sandbox.paypal.com/myaccount/money/" : "https://www.paypal.com/myaccount/money/"} target="_blank" rel="noreferrer" className="pressable mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 font-bold text-on-accent">{sandboxSingleMerchant ? "ABRIR PAYPAL SANDBOX" : "ABRIR PAYPAL"} <ArrowSquareOut size={20} weight="bold" /></a>
    <p className="mt-3 text-center text-xs text-muted">{sandboxSingleMerchant ? "El dinero de prueba está en la cuenta Business Sandbox de TipMe." : "TipMe no puede ver ni retirar el saldo total de tu cuenta PayPal."}</p>
  </section>;
}
