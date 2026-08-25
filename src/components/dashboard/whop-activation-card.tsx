import { ArrowRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export function WhopActivationCard({ connected }: { connected: boolean }) {
  if (connected) {
    return <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[#ff6243]/35 bg-[#ff6243]/8 px-4 py-3 text-sm font-semibold"><CheckCircle size={20} weight="fill" className="text-[#ff6243]" />Whop conectado · Ya puedes recibir tips</div>;
  }
  return <section className="mb-6 rounded-2xl border border-accent bg-surface p-5 shadow-[var(--shadow)] sm:flex sm:items-center sm:justify-between sm:gap-5"><div><p className="font-semibold">Activa los tips conectando Whop</p><p className="mt-1 text-sm text-muted">Tu página ya existe. Conecta Whop cuando quieras empezar a cobrar.</p></div><Link href="/dashboard/settings/payments" className="pressable mt-4 inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-accent-strong px-5 text-sm font-bold text-on-accent sm:mt-0">Conectar Whop<ArrowRight size={18} weight="bold" /></Link></section>;
}
