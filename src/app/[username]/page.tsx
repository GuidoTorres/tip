import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { TipForm } from "@/components/tips/tip-form";
import { DEFAULT_SUPPORT_EMAIL } from "@/features/legal/contact";
import { APPLICATION_CURRENCY } from "@/features/payments/application-currency";
import { getRequestLocale } from "@/lib/i18n/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type PublicCreator = {
  id: string;
  public_name: string | null;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  social_url: string | null;
  content_category: string | null;
  can_accept_tips: boolean;
};

function publicSocialLink(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return { href: url.toString(), hostname: url.hostname.replace(/^www\./, "") };
  } catch {
    return null;
  }
}

async function getCreator(username: string): Promise<PublicCreator | null> {
  const { data, error } = await createAdminSupabaseClient().rpc("get_public_creator", { requested_username: username }).maybeSingle();
  if (error || !data) return null;
  return data as PublicCreator;
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const creator = await getCreator(username);
  return creator
    ? { title: `Envía un tip a ${creator.public_name ?? creator.username}`, description: creator.bio ?? `Apoya a @${creator.username} en TipMe.` }
    : { title: "Perfil no encontrado" };
}

export default async function CreatorPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const locale = await getRequestLocale();
  const creator = await getCreator(username);
  if (!creator) notFound();

  const acceptsTips = creator.can_accept_tips === true;
  const initial = (creator.public_name ?? creator.username).charAt(0).toUpperCase();
  const social = publicSocialLink(creator.social_url);
  const reportHref = `mailto:${DEFAULT_SUPPORT_EMAIL}?subject=${encodeURIComponent(`Reporte de perfil @${creator.username}`)}`;
  const pendingReview = creator.can_accept_tips !== true;

  return <main className="min-h-[100dvh] px-4 py-5 sm:py-10">
    <div className="mx-auto max-w-md">
      <header className="flex items-center justify-between">
        <span className="text-lg font-bold tracking-[-0.04em]">TipMe<span className="text-accent-strong">.</span></span>
        <div className="flex items-center gap-2"><LanguageSwitcher locale={locale} /></div>
      </header>
      <section className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)] sm:p-8">
        <div className="flex items-center gap-4">
          {creator.avatar_url
            ? <Image src={creator.avatar_url} alt={`${locale === "es" ? "Foto de" : "Photo of"} ${creator.public_name ?? creator.username}`} width={72} height={72} className="size-18 rounded-2xl object-cover" priority />
            : <div className="grid size-18 place-items-center rounded-2xl bg-accent-strong text-2xl font-bold text-on-accent">{initial}</div>}
          <div className="min-w-0"><h1 className="truncate text-2xl font-semibold tracking-[-0.04em]">{creator.public_name ?? creator.username}</h1><p className="text-sm text-muted">@{creator.username}</p></div>
        </div>
        {creator.bio && <p className="mt-5 leading-relaxed text-muted">{creator.bio}</p>}
        {social && <a href={social.href} target="_blank" rel="noreferrer" className="pressable mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent"><ArrowSquareOut size={18} aria-hidden="true" />{locale === "es" ? `Ver perfil público en ${social.hostname}` : `View public profile on ${social.hostname}`}</a>}
        {acceptsTips
          ? <TipForm username={creator.username} currency={APPLICATION_CURRENCY} locale={locale} checkoutFeeBps={0} checkoutFixedFeeMinor={0} />
          : <div className="mt-8 rounded-2xl bg-surface-soft p-5 text-center"><p className="font-semibold">{pendingReview ? (locale === "es" ? "Esta página está pendiente de revisión" : "This page is pending review") : (locale === "es" ? "Esta página todavía no acepta tips" : "This page is not accepting tips yet")}</p><p className="mt-1 text-sm text-muted">{locale === "es" ? "Vuelve a intentarlo más adelante." : "Please try again later."}</p></div>}
      </section>
      <div className="mt-5 flex flex-col items-center gap-2 text-xs text-muted"><p>{locale === "es" ? "Pagos verificables mediante TipMe" : "Verifiable payments through TipMe"}</p><a href={reportHref} className="min-h-10 py-3 underline">{locale === "es" ? "Reportar esta página" : "Report this page"}</a></div>
    </div>
  </main>;
}
