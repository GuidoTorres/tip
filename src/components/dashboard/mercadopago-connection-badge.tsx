import { CheckCircle } from "@phosphor-icons/react/dist/ssr";

export function MercadoPagoConnectionBadge({ currency }: { currency: string }) {
  return <span aria-label="Mercado Pago conectado" className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#009ee3]/30 bg-[#009ee3]/10 px-3 py-1.5 text-sm font-semibold text-[#0078ad] dark:text-[#60c9f8]"><span className="rounded bg-[#009ee3] px-1.5 py-0.5 text-[10px] font-black text-white">MP</span> Mercado Pago · {currency}<CheckCircle size={18} weight="fill" className="text-success" /></span>;
}
