import { CheckCircle } from "@phosphor-icons/react/dist/ssr";

export function MercadoPagoConnectionBadge({ currency }: { currency: string }) {
  return <span aria-label="Mercado Pago conectado" className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-surface-soft px-3 py-1.5 text-sm font-semibold text-muted"><CheckCircle size={18} weight="fill" className="text-success" /> Mercado Pago · {currency}</span>;
}
