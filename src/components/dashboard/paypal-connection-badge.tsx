import { CheckCircle, Clock, PaypalLogo } from "@phosphor-icons/react/dist/ssr";

export function PayPalConnectionBadge({ verified = true }: { verified?: boolean }) {
  return <span
    aria-label={verified ? "PayPal verificado" : "PayPal configurado"}
    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#0070e0]/30 bg-[#0070e0]/10 px-3 py-1.5 text-sm font-semibold text-[#003087] dark:text-[#78b9ff]"
  >
    <PaypalLogo size={18} weight="fill" className="text-[#0070e0]" aria-hidden="true" />
    {verified ? "PayPal verificado" : "PayPal configurado"}
    {verified ? <CheckCircle size={18} weight="fill" className="text-success" aria-hidden="true" /> : <Clock size={18} weight="fill" className="text-warning" aria-hidden="true" />}
  </span>;
}
