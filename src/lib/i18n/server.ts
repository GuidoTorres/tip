import { cookies, headers } from "next/headers";
import { detectLocale, isLocale, type Locale } from "./config";

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const saved = cookieStore.get("tipme_locale")?.value;
  if (saved && isLocale(saved)) return saved;
  const headerStore = await headers();
  return detectLocale(headerStore.get("accept-language"));
}

