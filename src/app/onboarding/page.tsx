import { redirect } from "next/navigation";
import { ArrowRight, Bank, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import { completeOnboarding, saveDLocalGoSplitCode, saveOnboardingProfile } from "@/features/profiles/actions";
import { CopyLink } from "@/components/shared/copy-link";
import { ApplicationCurrencyField } from "@/components/shared/application-currency-field";
import { MercadoPagoConnect } from "@/components/payments/mercadopago-connect";

const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string; error?: string; mercadopago?: string }> }) {
  const { step: requestedStep = "1", error, mercadopago } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("public_name,username,bio,locale").eq("id", user.id).single();
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();
  const provider = serverEnv.PAYMENT_PROVIDER;
  const whopOnboarding = provider === "whop";
  const step = whopOnboarding ? "1" : requestedStep === "4" ? "3" : requestedStep;
  const totalSteps = whopOnboarding ? 1 : 3;
  const { data: mercadoPagoAccount } = provider === "mercadopago"
    ? await supabase.from("payment_accounts").select("status,provider_country,provider_currency").eq("creator_id", user.id).eq("provider", "mercadopago").maybeSingle()
    : { data: null };
  const { data: dLocalGoAccount } = provider === "dlocalgo"
    ? await supabase.from("payment_accounts").select("status,provider_merchant_id").eq("creator_id", user.id).eq("provider", "dlocalgo").maybeSingle()
    : { data: null };
  const username = profile?.username ?? "username";
  const publicUrl = `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/${username}`;

  return <main className="min-h-[100dvh] px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]"><div className="mx-auto max-w-lg">
    <div className="flex items-center justify-between"><span className="text-xl font-bold tracking-[-0.04em]">TipMe<span className="text-accent-strong">.</span></span><span className="text-sm text-muted">{step} de {totalSteps}</span></div>
    <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-soft"><div className="h-full bg-accent-strong transition-[width]" style={{ width: `${Math.min(totalSteps, Math.max(1, Number(step))) * (100 / totalSteps)}%` }} /></div>
    <section className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)] sm:p-8">
      {error && <p role="alert" className="mb-5 rounded-xl bg-surface-soft p-3 text-sm text-accent-strong">{error === "mercadopago_seller_required" ? "Necesitas una cuenta de Mercado Pago verificada y habilitada para recibir pagos."
        : error === "invalid_split_code" ? "Ese split code no tiene un formato válido. Cópialo tal cual aparece en dLocal Go."
        : error === "split_code_taken" ? "Ese split code ya está vinculado a otra cuenta de TipMe."
        : error === "dlocalgo_required" ? "Primero conecta tu cuenta de dLocal Go para poder recibir tips."
        : "No pudimos guardar este paso. Revisa los datos."}</p>}
      {step === "1" && <>
        <UserCircle size={32} className="text-accent-strong" weight="fill" />
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Tu página pública</h1>
        <p className="mt-2 text-muted">Así te verán las personas que quieran apoyarte.</p>
        <form action={saveOnboardingProfile} className="mt-7 space-y-5">
          <label className="block text-sm font-semibold">Nombre visible<input className={inputClass} name="publicName" required maxLength={80} defaultValue={profile?.public_name ?? ""} /></label>
          <label className="block text-sm font-semibold">Username<div className="mt-2 flex min-h-12 items-center rounded-xl border border-border bg-background px-4"><span className="text-muted">tipme.pro/</span><input name="username" required minLength={3} maxLength={30} defaultValue={profile?.username ?? ""} className="min-w-0 flex-1 bg-transparent outline-none" /></div><span className="mt-2 block font-normal text-muted">Será tu enlace único para recibir tips.</span></label>
          <label className="block text-sm font-semibold">Foto<input className="mt-2 block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface-soft file:px-4 file:py-3 file:font-semibold" type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/avif" /></label>
          <label className="block text-sm font-semibold">Descripción<textarea className={`${inputClass} min-h-24 py-3`} name="bio" maxLength={180} defaultValue={profile?.bio ?? ""} /></label>
          {provider !== "mercadopago" && <ApplicationCurrencyField />}
          {provider === "mercadopago" && <p className="rounded-xl bg-surface-soft p-4 text-sm text-muted">La moneda se configura automáticamente según el país de tu cuenta Mercado Pago.</p>}
          <input type="hidden" name="locale" value={profile?.locale ?? "es"} />
          <SubmitButton label={whopOnboarding ? "Crear mi página" : "Continuar"} />
        </form>
      </>}
      {step === "2" && provider === "mercadopago" && <><Bank size={32} className="text-accent-strong" weight="fill" /><h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Conecta Mercado Pago</h1><p className="mt-2 text-muted">El fan paga directamente a tu cuenta y TipMe descuenta automáticamente su comisión.</p>{mercadopago === "connected" && <p className="mt-4 rounded-xl bg-surface-soft p-3 text-sm font-semibold text-success">Cuenta vinculada correctamente.</p>}<div className="mt-7"><MercadoPagoConnect connected={mercadoPagoAccount?.status === "connected"} country={mercadoPagoAccount?.provider_country} /></div></>}
      {step === "2" && provider === "dlocalgo" && <>
        <Bank size={32} className="text-accent-strong" weight="fill" />
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Conecta dLocal Go</h1>
        <p className="mt-2 text-muted">Te enviamos una invitación a tu correo. Acéptala en dLocal Go y pega aquí el split code que aparece en tu panel: con él, cada tip llega a tu cuenta y TipMe descuenta su comisión.</p>
        {dLocalGoAccount?.status === "connected" && <p className="mt-4 rounded-xl bg-surface-soft p-3 text-sm font-semibold text-success">Cuenta vinculada correctamente.</p>}
        <form action={saveDLocalGoSplitCode} className="mt-7 space-y-5">
          <label className="block text-sm font-semibold">Split code<input className={inputClass} name="splitCode" required minLength={6} maxLength={64} autoComplete="off" spellCheck={false} defaultValue={dLocalGoAccount?.provider_merchant_id ?? ""} /><span className="mt-2 block font-normal text-muted">Lo encuentras en dLocal Go, dentro de la colaboración con TipMe.</span></label>
          <SubmitButton label="Continuar" />
        </form>
      </>}
      {step === "2" && provider !== "mercadopago" && provider !== "dlocalgo" && <><Bank size={32} className="text-accent-strong" weight="fill" /><h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Modo desarrollo</h1><p className="mt-2 text-muted">Estás usando el proveedor simulado: no hay una cuenta que conectar y ningún cobro es real.</p><form action={completeOnboarding} className="mt-7"><SubmitButton label="Continuar" /></form></>}
      {step === "3" && <><h1 className="text-3xl font-semibold tracking-[-0.04em]">Tu link está listo</h1><p className="mt-2 text-muted">Compártelo para recibir tu primer tip.</p><div className="mt-8 rounded-2xl bg-surface-soft p-5 text-center"><p className="break-all text-lg font-semibold text-accent-strong">tipme.pro/{username}</p><div className="mt-4"><CopyLink url={publicUrl} /></div></div><form action={completeOnboarding} className="mt-6"><SubmitButton label="Ir a mi dashboard" /></form></>}
    </section>
  </div></main>;
}

function SubmitButton({ label }: { label: string }) {
  return <button className="pressable flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent-strong px-6 py-4 font-bold text-on-accent hover:bg-accent-pressed">{label}<ArrowRight size={20} weight="bold" /></button>;
}
