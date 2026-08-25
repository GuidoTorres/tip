import { ArrowRight, CheckCircle, PaypalLogo } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export function PayPalActivationCard({ connected, verified = false }: { connected: boolean; verified?: boolean }) {
  if (connected) return <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[#0070e0]/30 bg-[#0070e0]/10 px-4 py-3 text-sm font-semibold text-[#003087] dark:text-[#78b9ff]"><PaypalLogo size={20} weight="fill" /><CheckCircle size={18} weight="fill" className="text-success" />PayPal {verified ? "verificado" : "conectado"}</div>;
  return <section className="mb-6 rounded-2xl border border-[#0070e0]/35 bg-surface p-5 shadow-[var(--shadow)] sm:flex sm:items-center sm:justify-between sm:gap-5"><div><p className="font-semibold">Conecta PayPal para recibir tips</p><p className="mt-1 text-sm text-muted">Tu página ya existe. Conecta tu cuenta cuando quieras empezar a cobrar.</p></div><Link href="/onboarding?step=2" className="pressable mt-4 inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#0070e0] px-5 text-sm font-bold text-white sm:mt-0">Conectar PayPal<ArrowRight size={18} weight="bold" /></Link></section>;
}
