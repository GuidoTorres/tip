import Link from "next/link";
import { getRequestLocale } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale();
  return <main className="min-h-[100dvh] px-4 py-5 sm:py-10"><div className="mx-auto max-w-3xl"><header className="flex items-center justify-between"><Link href="/" className="text-xl font-bold tracking-[-0.04em]">TipMe<span className="text-accent">.</span></Link><LanguageSwitcher locale={locale} /></header><div className="mt-10 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)] sm:p-10">{children}</div><nav aria-label={locale === "es" ? "Documentos legales" : "Legal documents"} className="flex flex-wrap justify-center gap-x-5 gap-y-2 py-6 text-xs text-muted"><Link href="/terms">{locale === "es" ? "Términos" : "Terms"}</Link><Link href="/refund-policy">{locale === "es" ? "Reembolsos" : "Refunds"}</Link><Link href="/privacy">{locale === "es" ? "Privacidad" : "Privacy"}</Link></nav></div></main>;
}
