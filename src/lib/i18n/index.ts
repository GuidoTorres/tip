import { en } from "./en";
import { es } from "./es";
import type { Locale } from "./config";

type WidenStrings<T> = { [K in keyof T]: T[K] extends string ? string : WidenStrings<T[K]> };
export type Dictionary = WidenStrings<typeof es>;

const dictionaries: Record<Locale, Dictionary> = { es, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function formatMoney(
  amountMinor: number,
  currency: string,
  locale: Locale,
): string {
  const fractionDigits = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits ?? 2;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amountMinor / 10 ** fractionDigits);
}
