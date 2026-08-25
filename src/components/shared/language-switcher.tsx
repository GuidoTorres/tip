"use client";

import { setLocale } from "@/features/profiles/locale-action";
import type { Locale } from "@/lib/i18n/config";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  return <form action={setLocale}><label className="sr-only" htmlFor="tipme-locale">Idioma</label><select id="tipme-locale" name="locale" defaultValue={locale} onChange={(event) => event.currentTarget.form?.requestSubmit()} className="min-h-11 rounded-full border border-transparent bg-transparent px-2 py-2 text-xs font-semibold text-muted hover:border-border hover:bg-surface"><option value="es">ES</option><option value="en">EN</option></select></form>;
}
