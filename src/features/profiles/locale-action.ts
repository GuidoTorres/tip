"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/lib/i18n/config";

export async function setLocale(formData: FormData) {
  const locale = String(formData.get("locale") ?? "");
  if (!isLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set("tipme_locale", locale, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 31_536_000, path: "/" });
  revalidatePath("/", "layout");
}

