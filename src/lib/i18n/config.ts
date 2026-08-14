export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function detectLocale(value?: string | null): Locale {
  const language = value?.toLowerCase().split(/[-_]/)[0];
  return language === "en" ? "en" : "es";
}

