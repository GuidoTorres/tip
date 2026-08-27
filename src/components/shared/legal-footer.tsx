import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

export function LegalFooter({ locale, year }: { locale: Locale; year: number }) {
  const t = getDictionary(locale).legalFooter;

  return (
    <footer className="flex flex-col items-center justify-between gap-2 border-t border-border py-4 text-center text-xs text-muted sm:flex-row sm:text-left">
      <p>© {year} TipMe. {t.rights}</p>
      <nav aria-label={t.navigation} className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        <Link href="/terms" className="hover:text-foreground">{t.terms}</Link>
        <Link href="/privacy" className="hover:text-foreground">{t.privacy}</Link>
        <Link href="/refund-policy" className="hover:text-foreground">{t.refunds}</Link>
      </nav>
    </footer>
  );
}
