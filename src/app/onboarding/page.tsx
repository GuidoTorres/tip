import { redirect } from "next/navigation";
import { ArrowRight, Bank, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import { completeOnboarding, saveOnboardingProfile } from "@/features/profiles/actions";
import { CopyLink } from "@/components/shared/copy-link";
import { PayPalPayoutEmailForm } from "@/components/payouts/paypal-payout-email-form";
import { OnboardingProfileForm } from "@/components/onboarding/onboarding-profile-form";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string; paypal?: string }>;
}) {
  const { step: requestedStep = "1", error, paypal } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("public_name,username,bio,social_url,content_category,locale")
    .eq("id", user.id)
    .single();

  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();
  const platformPayouts = serverEnv.PAYPAL_FLOW === "platform_payouts";
  const profileOnlyOnboarding = platformPayouts;
  const step = profileOnlyOnboarding ? "1" : requestedStep === "4" ? "3" : requestedStep;
  const totalSteps = profileOnlyOnboarding ? 1 : 3;

  const { data: paypalAccount } = platformPayouts
    ? await supabase
      .from("payout_accounts")
      .select("status,provider_account_id,bank_name")
      .eq("creator_id", user.id)
      .eq("provider", "paypal")
      .maybeSingle()
    : await supabase
      .from("payment_accounts")
      .select("status,onboarding_completed,payments_receivable,card_payments_enabled")
      .eq("creator_id", user.id)
      .eq("provider", "paypal")
      .maybeSingle();

  const username = profile?.username ?? "username";
  const publicUrl = `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/${username}`;
  const paypalPayoutEmail = platformPayouts ? ((paypalAccount as { provider_account_id?: string } | null)?.provider_account_id ?? "") : "";

  const errorMessage = error === "paypal_required"
    ? platformPayouts
      ? "Guarda tu correo de PayPal para poder recibir tips."
      : "Conecta tu cuenta PayPal para poder recibir tips."
    : error === "paypal_restricted"
      ? "PayPal vinculó la cuenta, pero todavía está completando su activación."
      : error === "paypal_invalid"
        ? "No pudimos validar la conexión con PayPal. Inténtalo nuevamente."
        : error === "paypal_unavailable"
          ? "No pudimos comprobar PayPal en este momento. Inténtalo nuevamente."
          : error
            ? "No pudimos guardar este paso. Revisa los datos."
            : null;

  const paypalPayoutStatus = paypalAccount?.status === "verified" ? "verified" : "pending";

  return (
    <main className="min-h-[100dvh] px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold tracking-[-0.04em]">
            TipMe<span className="text-accent-strong">.</span>
          </span>
          <span className="text-sm text-muted">
            {step} de {totalSteps}
          </span>
        </div>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-soft">
          <div
            className="h-full bg-accent-strong transition-[width]"
            style={{ width: `${Math.min(totalSteps, Math.max(1, Number(step))) * (100 / totalSteps)}%` }}
          />
        </div>
        <section className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)] sm:p-8">
          {errorMessage && (
            <p role="alert" className="mb-5 rounded-xl bg-surface-soft p-3 text-sm text-accent-strong">
              {errorMessage}
            </p>
          )}

          {step === "1" && (
            <>
              <UserCircle size={32} className="text-accent-strong" weight="fill" />
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Tu pagina publica</h1>
              <p className="mt-2 text-muted">Asi te veran las personas que quieran apoyarte.</p>
              <OnboardingProfileForm
                action={saveOnboardingProfile}
                publicName={profile?.public_name ?? ""}
                username={profile?.username ?? ""}
                bio={profile?.bio ?? ""}
                socialUrl={profile?.social_url ?? ""}
                contentCategory={profile?.content_category ?? null}
                locale={profile?.locale === "en" ? "en" : "es"}
                showCurrency
                submitLabel={profileOnlyOnboarding ? "Crear mi página" : "Continuar"}
              />
            </>
          )}

          {step === "2" && (
            <>
              <Bank size={32} className="text-accent-strong" weight="fill" />
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
                {platformPayouts ? "Conecta tu correo PayPal" : "Conecta PayPal"}
              </h1>
              <p className="mt-2 text-muted">
                {platformPayouts
                  ? "TipMe usara ese correo como destino de retiro."
                  : "PayPal gestionara tus datos financieros. TipMe solo recibira la confirmacion necesaria para habilitar tus tips."}
              </p>
              {paypal === "connected" && (
                <p className="mt-4 rounded-xl bg-surface-soft p-3 text-sm font-semibold text-success">
                  {platformPayouts ? "Correo PayPal guardado correctamente." : "Cuenta PayPal vinculada correctamente."}
                </p>
              )}
              <div className="mt-7">
                <PayPalPayoutEmailForm
                  email={paypalPayoutEmail}
                  status={paypalPayoutStatus}
                  returnTo="/onboarding?step=3"
                />
              </div>
            </>
          )}

          {step === "3" && (
            <>
              <h1 className="text-3xl font-semibold tracking-[-0.04em]">Tu link esta listo</h1>
              <p className="mt-2 text-muted">Compartelo para recibir tu primer tip.</p>
              <div className="mt-8 rounded-2xl bg-surface-soft p-5 text-center">
                <p className="break-all text-lg font-semibold text-accent-strong">tipme.pro/{username}</p>
                <div className="mt-4">
                  <CopyLink url={publicUrl} />
                </div>
              </div>
              <form action={completeOnboarding} className="mt-6">
                <SubmitButton label="Ir a mi dashboard" />
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function SubmitButton({ label }: { label: string }) {
  return (
    <button className="pressable flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent-strong px-6 py-4 font-bold text-on-accent hover:bg-accent-pressed">
      {label}
      <ArrowRight size={20} weight="bold" />
    </button>
  );
}
