import { ArrowRight, Heart, LockKey, Lightning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { LegalFooter } from "@/components/shared/legal-footer";
import { getMisroutedOAuthCallback } from "@/features/auth/oauth";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const callback = getMisroutedOAuthCallback((await searchParams).code);
  if (callback) redirect(callback);
  const locale = await getRequestLocale();
  const t = getDictionary(locale);

  return (
    <main className="min-h-[100dvh] px-4 py-5 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-6xl flex-col">
        <nav className="flex h-14 items-center justify-between" aria-label="Principal">
          <Link href="/" className="inline-flex min-h-11 items-center text-xl font-bold tracking-[-0.04em]">TipMe<span className="text-accent-strong">.</span></Link>
          <div className="flex items-center gap-2"><LanguageSwitcher locale={locale} /><Link href="/login" className="pressable rounded-full border border-border px-5 py-3 text-sm font-semibold hover:bg-surface">{t.landing.login}</Link></div>
        </nav>

        <section className="grid flex-1 items-center gap-8 py-6 md:grid-cols-[1.15fr_0.85fr] md:gap-10 md:py-16">
          <div className="max-w-2xl">
            <Heart size={38} weight="fill" className="mb-4 text-accent-strong" aria-hidden="true" />
            <h1 className="text-5xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-6xl md:max-w-[12ch] md:text-7xl">
              {t.landing.headline}
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">{t.landing.body}</p>
            <Link href="/signup" className="pressable mt-8 flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-accent-strong px-7 py-4 font-bold text-on-accent hover:bg-accent-pressed sm:inline-flex sm:w-auto">
              {t.landing.signup}<ArrowRight size={20} weight="bold" aria-hidden="true" />
            </Link>
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span>{t.landing.coverage}</span>
              <span aria-hidden="true" className="tracking-wide">🇲🇽 🇨🇴 🇵🇪 🇨🇱 🇦🇷 🇧🇷 🇺🇾</span>
              <span>{t.landing.coverageMore}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow)] sm:p-8">
            <p className="text-sm font-semibold text-muted">{t.landing.trust}</p>
            <div className="mt-6 space-y-6">
              <div className="flex gap-4"><Lightning size={26} className="shrink-0 text-accent-strong" weight="fill" /><div><p className="font-semibold">{locale === "es" ? "Una sola acción" : "One clear action"}</p><p className="mt-1 text-sm leading-relaxed text-muted">{locale === "es" ? "Tu fan abre el link, elige un monto y envía el tip." : "Your fan opens the link, picks an amount, and sends the tip."}</p></div></div>
              <div className="flex gap-4"><Heart size={26} className="shrink-0 text-accent-strong" weight="fill" /><div><p className="font-semibold">{locale === "es" ? "Aviso inmediato" : "Immediate alert"}</p><p className="mt-1 text-sm leading-relaxed text-muted">{locale === "es" ? "Recibes una notificación cuando el pago queda confirmado." : "You get notified when the payment is confirmed."}</p></div></div>
              <div className="flex gap-4"><LockKey size={26} className="shrink-0 text-accent-strong" weight="fill" /><div><p className="font-semibold">{locale === "es" ? "Saldo verificable" : "Verifiable balance"}</p><p className="mt-1 text-sm leading-relaxed text-muted">{locale === "es" ? "Cada movimiento queda registrado antes de actualizar tu saldo." : "Every movement is recorded before your balance changes."}</p></div></div>
            </div>
          </div>
        </section>
        <LegalFooter locale={locale} year={new Date().getFullYear()} />
      </div>
    </main>
  );
}
