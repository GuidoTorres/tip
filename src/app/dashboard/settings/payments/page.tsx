import { ArrowSquareOut, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { connectWhopCompany } from "@/features/profiles/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env/server";

const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent";

export default async function PaymentSettingsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const { connected, error } = await searchParams;
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER !== "whop") redirect("/dashboard/settings");
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: account } = await supabase.from("payment_accounts").select("provider_merchant_id,status").eq("creator_id", user.id).eq("provider", "whop").maybeSingle();
  const isConnected = account?.status === "connected";
  const installUrl = `https://whop.com/apps/${encodeURIComponent(env.WHOP_APP_ID)}/install`;
  const errorMessage = error === "whop_company_invalid" ? "El ID debe comenzar con biz_."
    : error === "whop_app_not_installed" ? "TipMe todavía no tiene acceso a esa empresa. Instala la app en Whop y vuelve a comprobar."
    : error === "whop_company_taken" ? "Esa empresa Whop ya está vinculada a otra cuenta TipMe."
    : error ? "No pudimos conectar Whop. Inténtalo nuevamente." : null;

  return <div className="mx-auto max-w-xl"><h1 className="text-3xl font-semibold tracking-[-0.04em]">Cobros con Whop</h1><p className="mt-2 text-muted">Tu cuenta TipMe funciona sin Whop, pero necesitas conectarlo para recibir tips.</p>
    {(connected === "1" || isConnected) && <div className="mt-6 rounded-2xl border border-[#ff6243]/35 bg-[#ff6243]/8 p-5"><p className="flex items-center gap-2 font-semibold"><CheckCircle size={22} weight="fill" className="text-[#ff6243]" />Whop conectado</p><p className="mt-2 text-sm text-muted">Los nuevos tips se cobrarán en tu empresa Whop. TipMe no guardará ni transferirá ese dinero.</p>{account?.provider_merchant_id && <p className="mt-3 font-mono text-xs text-muted">{account.provider_merchant_id}</p>}</div>}
    {!isConnected && <section className="mt-6 space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)]">
      {errorMessage && <p role="alert" className="rounded-xl bg-surface-soft p-3 text-sm font-semibold text-accent-strong">{errorMessage}</p>}
      <div><span className="text-xs font-bold text-muted">PASO 1</span><h2 className="mt-1 text-lg font-semibold">Instala TipMe en Whop</h2><p className="mt-1 text-sm text-muted">Whop te pedirá iniciar sesión o crear una cuenta y elegir la empresa que recibirá los tips.</p><a href={installUrl} target="_blank" rel="noreferrer" className="pressable mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#ff6243] px-5 font-bold text-white">Abrir Whop<ArrowSquareOut size={19} weight="bold" /></a></div>
      <div className="border-t border-border pt-5"><span className="text-xs font-bold text-muted">PASO 2</span><h2 className="mt-1 text-lg font-semibold">Comprueba la conexión</h2><form action={connectWhopCompany} className="mt-3"><label className="block text-sm font-semibold">ID de tu empresa Whop<input className={inputClass} name="companyId" required minLength={10} maxLength={68} placeholder="biz_..." autoComplete="off" spellCheck={false} /></label><p className="mt-2 text-xs text-muted">Copia el identificador que empieza con biz_ desde tu panel de Whop.</p><button className="pressable mt-4 min-h-12 w-full rounded-full border border-accent px-5 font-bold text-accent-strong hover:bg-surface-soft">Comprobar y activar tips</button></form></div>
    </section>}
  </div>;
}
