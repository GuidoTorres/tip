import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { TipForm } from "@/components/tips/tip-form";
import type { Currency } from "@/features/payments/types";
import { APPLICATION_CURRENCY } from "@/features/payments/application-currency";
import { getRequestLocale } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { getServerEnv } from "@/lib/env/server";

type PublicCreator = { id: string; public_name: string | null; username: string; avatar_url: string | null; bio: string | null; preferred_currency: Currency };

async function getCreator(username: string): Promise<PublicCreator | null> {
  const { data, error } = await createAdminSupabaseClient().rpc("get_public_creator", { requested_username: username }).maybeSingle();
  if (error || !data) return null;
  return data as PublicCreator;
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const creator = await getCreator(username);
  return creator ? { title: `Envía un tip a ${creator.public_name ?? creator.username}`, description: creator.bio ?? `Apoya a @${creator.username} en TipMe.` } : { title: "Perfil no encontrado" };
}

export default async function CreatorPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const locale = await getRequestLocale();
  const creator = await getCreator(username);
  if (!creator) notFound();
  const env = getServerEnv();
  const initial = (creator.public_name ?? creator.username).charAt(0).toUpperCase();
  return <main className="min-h-[100dvh] px-4 py-5 sm:py-10"><div className="mx-auto max-w-md"><header className="flex items-center justify-between"><span className="text-lg font-bold tracking-[-0.04em]">TipMe<span className="text-accent">.</span></span><div className="flex items-center gap-2"><span className="text-sm text-muted">@{creator.username}</span><LanguageSwitcher locale={locale} /></div></header><section className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)] sm:p-8"><div className="flex items-center gap-4">{creator.avatar_url ? <Image src={creator.avatar_url} alt={`${locale === "es" ? "Foto de" : "Photo of"} ${creator.public_name ?? creator.username}`} width={72} height={72} className="size-18 rounded-2xl object-cover" priority /> : <div className="grid size-18 place-items-center rounded-2xl bg-accent text-2xl font-bold text-on-accent">{initial}</div>}<div className="min-w-0"><h1 className="truncate text-2xl font-semibold tracking-[-0.04em]">{creator.public_name ?? creator.username}</h1><p className="text-sm text-muted">@{creator.username}</p></div></div>{creator.bio && <p className="mt-5 leading-relaxed text-muted">{creator.bio}</p>}<TipForm username={creator.username} currency={APPLICATION_CURRENCY} locale={locale} checkoutFeeBps={env.PAYPAL_CHECKOUT_FEE_BPS} checkoutFixedFeeMinor={env.PAYPAL_CHECKOUT_FIXED_FEE_MINOR} /></section><p className="mt-5 text-center text-xs text-muted">{locale === "es" ? "Pagos verificables mediante TipMe" : "Verifiable payments through TipMe"}</p></div></main>;
}
