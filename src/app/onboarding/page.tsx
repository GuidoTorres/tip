import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Bank, Bell, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import { completeOnboarding, saveMockPayoutAccount, saveOnboardingProfile } from "@/features/profiles/actions";
import { PushSetup } from "@/components/push/push-setup";
import { CopyLink } from "@/components/shared/copy-link";
import { ApplicationCurrencyField } from "@/components/shared/application-currency-field";
import { PayPalConnect } from "@/components/payments/paypal-connect";
import { PayPalSandboxAccount } from "@/components/payments/paypal-sandbox-account";
import { PayPalOnboardingPopup } from "@/components/payments/paypal-onboarding-popup";
import type { PayPalOnboardingPopupStatus } from "@/features/payments/paypal-onboarding-popup";
import { PayPalPayoutEmailForm } from "@/components/payouts/paypal-payout-email-form";

const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string; error?: string; paypal?: string }> }) {
  const { step = "1", error, paypal } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("public_name,username,bio,locale").eq("id", user.id).single();
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();
  const provider = serverEnv.PAYMENT_PROVIDER;
  const platformPayouts = provider === "paypal" && serverEnv.PAYPAL_FLOW === "platform_payouts";
  const singleMerchantSandbox = provider === "paypal" && !platformPayouts && serverEnv.PAYPAL_SANDBOX_SINGLE_MERCHANT;
  const { data: paymentAccount } = provider === "paypal" && !platformPayouts && !singleMerchantSandbox
    ? await supabase.from("payment_accounts").select("status,card_payments_enabled").eq("creator_id", user.id).eq("provider", "paypal").maybeSingle()
    : { data: null };
  const { data: payoutAccount } = platformPayouts
    ? await supabase.from("payout_accounts").select("provider_account_id,status").eq("creator_id", user.id).eq("provider", "paypal").order("created_at", { ascending: true }).limit(1).maybeSingle()
    : { data: null };
  const username = profile?.username ?? "username";
  const publicUrl = `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/${username}`;
  const paypalPopupResult = ["connected", "restricted", "invalid", "unavailable"].includes(paypal ?? "")
    ? paypal as PayPalOnboardingPopupStatus
    : undefined;

  return <main className="min-h-[100dvh] px-4 py-8"><PayPalOnboardingPopup result={paypalPopupResult} /><div className="mx-auto max-w-lg">
    <div className="flex items-center justify-between"><span className="text-xl font-bold tracking-[-0.04em]">TipMe<span className="text-accent">.</span></span><span className="text-sm text-muted">{step} de 4</span></div>
    <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-soft"><div className="h-full bg-accent transition-[width]" style={{ width: `${Math.min(4, Math.max(1, Number(step))) * 25}%` }} /></div>
    <section className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)] sm:p-8">
      {error && <p role="alert" className="mb-5 rounded-xl bg-surface-soft p-3 text-sm text-accent-strong">No pudimos guardar este paso. Revisa los datos.</p>}
      {step === "1" && <>
        <UserCircle size={32} className="text-accent" weight="fill" />
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Tu página pública</h1>
        <p className="mt-2 text-muted">Así te verán las personas que quieran apoyarte.</p>
        <form action={saveOnboardingProfile} className="mt-7 space-y-5">
          <label className="block text-sm font-semibold">Nombre visible<input className={inputClass} name="publicName" required maxLength={80} defaultValue={profile?.public_name ?? ""} /></label>
          <label className="block text-sm font-semibold">Username<div className="mt-2 flex min-h-12 items-center rounded-xl border border-border bg-background px-4"><span className="text-muted">tipme.pro/</span><input name="username" required minLength={3} maxLength={30} defaultValue={profile?.username ?? ""} className="min-w-0 flex-1 bg-transparent outline-none" /></div><span className="mt-2 block font-normal text-muted">Será tu enlace único para recibir tips.</span></label>
          <label className="block text-sm font-semibold">Foto<input className="mt-2 block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface-soft file:px-4 file:py-3 file:font-semibold" type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/avif" /></label>
          <label className="block text-sm font-semibold">Descripción<textarea className={`${inputClass} min-h-24 py-3`} name="bio" maxLength={180} defaultValue={profile?.bio ?? ""} /></label>
          <ApplicationCurrencyField />
          <input type="hidden" name="locale" value={profile?.locale ?? "es"} />
          <SubmitButton label="Continuar" />
        </form>
      </>}
      {step === "2" && platformPayouts && <><Bank size={32} className="text-accent" weight="fill" /><h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Configura tu PayPal</h1><p className="mt-2 text-muted">Usaremos este correo para enviarte tus retiros. Puede ser una cuenta PayPal personal.</p><div className="mt-7"><PayPalPayoutEmailForm email={payoutAccount?.provider_account_id ?? user.email ?? ""} status={payoutAccount?.status === "verified" ? "verified" : payoutAccount?.status === "pending" ? "pending" : undefined} returnTo="/onboarding?step=3" /></div></>}
      {step === "2" && singleMerchantSandbox && <><Bank size={32} className="text-accent" weight="fill" /><h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">PayPal para tus tips</h1><p className="mt-2 text-muted">Prueba el recorrido completo con una cuenta Sandbox compartida.</p><div className="mt-7"><PayPalSandboxAccount /></div></>}
      {step === "2" && provider === "paypal" && !platformPayouts && !singleMerchantSandbox && <><Bank size={32} className="text-accent" weight="fill" /><h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Conecta tu PayPal</h1><p className="mt-2 text-muted">Tus tips llegarán directamente a tu cuenta PayPal.</p><div className="mt-7"><PayPalConnect connected={paymentAccount?.status === "connected"} cardEnabled={Boolean(paymentAccount?.card_payments_enabled)} /></div></>}
      {step === "2" && provider !== "paypal" && <><Bank size={32} className="text-accent" weight="fill" /><h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Método de retiro</h1><p className="mt-2 text-muted">Para el piloto usaremos una cuenta bancaria simulada.</p><form action={saveMockPayoutAccount} className="mt-7 space-y-5"><label className="block text-sm font-semibold">Banco<input className={inputClass} name="bankName" required maxLength={80} defaultValue="Banco Demo" /></label><label className="block text-sm font-semibold">Últimos 4 dígitos<input className={inputClass} name="last4" required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} defaultValue="4821" /></label><div className="rounded-xl bg-surface-soft p-4 text-sm"><strong className="text-success">Verificación mock</strong><p className="mt-1 text-muted">No guardaremos datos bancarios reales.</p></div><SubmitButton label="Verificar y continuar" /></form></>}
      {step === "3" && <><Bell size={32} className="text-accent" weight="fill" /><h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">No te pierdas ningún tip</h1><p className="mt-2 mb-7 text-muted">Te avisaremos en cuanto recibas un pago confirmado.</p><PushSetup vapidPublicKey={publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY} /><Link href="/onboarding?step=4" className="mt-5 flex min-h-12 items-center justify-center font-semibold text-muted">Continuar por ahora <ArrowRight className="ml-2" /></Link></>}
      {step === "4" && <><h1 className="text-3xl font-semibold tracking-[-0.04em]">Tu link está listo</h1><p className="mt-2 text-muted">Compártelo para recibir tu primer tip.</p><div className="mt-8 rounded-2xl bg-surface-soft p-5 text-center"><p className="break-all text-lg font-semibold text-accent">tipme.pro/{username}</p><div className="mt-4"><CopyLink url={publicUrl} /></div></div><form action={completeOnboarding} className="mt-6"><SubmitButton label="Ir a mi dashboard" /></form></>}
    </section>
  </div></main>;
}

function SubmitButton({ label }: { label: string }) {
  return <button className="pressable flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 font-bold text-on-accent hover:bg-accent-strong">{label}<ArrowRight size={20} weight="bold" /></button>;
}
