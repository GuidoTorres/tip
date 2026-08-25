import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { TipForm } from "@/components/tips/tip-form";
import { APPLICATION_CURRENCY } from "@/features/payments/application-currency";
import { getRequestLocale } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { getServerEnv } from "@/lib/env/server";

type PublicCreator = { id: string; public_name: string | null; username: string; avatar_url: string | null; bio: string | null };

async function getCreator(username: string): Promise<PublicCreator | null> {
  const { data, error } = await createAdminSupabaseClient().rpc("get_public_creator", { requested_username: username }).maybeSingle();
  if (error || !data) return null;
  return data as PublicCreator;
}

async function creatorAcceptsTips(creatorId: string, provider: string) {
  if (provider !== "whop") return true;
  const { data } = await createAdminSupabaseClient().from("payment_accounts").select("id")
    .eq("creator_id", creatorId).eq("provider", "whop").eq("status", "connected")
    .eq("onboarding_completed", true).eq("payments_receivable", true).maybeSingle();
  return Boolean(data);
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
  const acceptsTips = await creatorAcceptsTips(creator.id, env.PAYMENT_PROVIDER);
  const initial = (creator.public_name ?? creator.username).charAt(0).toUpperCase();

  return <main className="min-h-[100dvh] px-4 py-5 sm:py-10"><div className="mx-auto max-w-md"><header className="flex items-center justify-between"><span className="text-lg font-bold tracking-[-0.04em]">TipMe<span className="text-accent-strong">.</span></span><div className="flex items-center gap-2"><LanguageSwitcher locale={locale} /></div></header><section className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)] sm:p-8"><div className="flex items-center gap-4">{creator.avatar_url ? <Image src={creator.avatar_url} alt={`${locale === "es" ? "Foto de" : "Photo of"} ${creator.public_name ?? creator.username}`} width={72} height={72} className="size-18 rounded-2xl object-cover" priority /> : <div className="grid size-18 place-items-center rounded-2xl bg-accent-strong text-2xl font-bold text-on-accent">{initial}</div>}<div className="min-w-0"><h1 className="truncate text-2xl font-semibold tracking-[-0.04em]">{creator.public_name ?? creator.username}</h1><p className="text-sm text-muted">@{creator.username}</p></div></div>{creator.bio && <p className="mt-5 leading-relaxed text-muted">{creator.bio}</p>}{env.PAYMENT_PROVIDER === "dlocalgo" && <p className="mt-5 rounded-xl bg-surface-soft px-4 py-3 text-xs leading-relaxed text-muted">{locale === "es" ? "Pagos disponibles en países compatibles con dLocal Go. Actualmente orientado a Latinoamérica." : "Payments are available in countries supported by dLocal Go. Currently focused on Latin America."}</p>}{acceptsTips ? <TipForm username={creator.username} currency={APPLICATION_CURRENCY} locale={locale} checkoutFeeBps={0} checkoutFixedFeeMinor={0} allowProcessingSupport={env.PAYMENT_PROVIDER !== "mercadopago" && env.PAYMENT_PROVIDER !== "whop"} /> : <div className="mt-8 rounded-2xl bg-surface-soft p-5 text-center"><p className="font-semibold">{locale === "es" ? "Esta página todavía no acepta tips" : "This page is not accepting tips yet"}</p><p className="mt-1 text-sm text-muted">{locale === "es" ? "Vuelve a intentarlo más adelante." : "Please try again later."}</p></div>}</section><p className="mt-5 text-center text-xs text-muted">{locale === "es" ? "Pagos verificables mediante TipMe" : "Verifiable payments through TipMe"}</p></div></main>;
}
