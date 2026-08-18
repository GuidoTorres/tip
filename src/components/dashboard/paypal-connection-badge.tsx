import { CheckCircle, PaypalLogo } from "@phosphor-icons/react/dist/ssr";

export function PayPalConnectionBadge() {
  return <span
    aria-label="PayPal enlazado"
    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#0070e0]/30 bg-[#0070e0]/10 px-3 py-1.5 text-sm font-semibold text-[#003087] dark:text-[#78b9ff]"
  >
    <PaypalLogo size={18} weight="fill" className="text-[#0070e0]" aria-hidden="true" />
    PayPal enlazado
    <CheckCircle size={18} weight="fill" className="text-success" aria-hidden="true" />
  </span>;
}
