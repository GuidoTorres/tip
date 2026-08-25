import { notFound } from "next/navigation";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";
import { formatMoney } from "@/lib/i18n";
import { MockGateway } from "@/components/payments/mock-gateway";
import type { Currency } from "@/features/payments/types";
import { mockSimulatorAllowed } from "@/lib/env/runtime";

export default async function MockPaymentPage({ params }: { params: Promise<{ paymentId: string }> }) {
  if (!mockSimulatorAllowed(process.env) || getServerEnv().PAYMENT_PROVIDER !== "mock") notFound();
  const { paymentId } = await params;
  const { data } = await createAdminSupabaseClient().from("tips").select("id,amount_minor,currency,profiles!tips_creator_id_fkey(public_name,username)").eq("provider", "mock").eq("provider_payment_id", paymentId).single();
  if (!data) notFound();
  const tip = data as unknown as { amount_minor: number; currency: Currency; profiles: { public_name: string | null; username: string } | null };
  return <main className="grid min-h-[100dvh] place-items-center px-4 py-10"><section className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)] sm:p-8"><div className="flex items-center justify-between"><span className="text-xl font-bold tracking-[-0.04em]">TipMe<span className="text-accent-strong">.</span></span><span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-muted">Gateway mock</span></div><div className="mt-10 text-center"><ShieldCheck size={42} weight="fill" className="mx-auto text-accent-strong" /><p className="mt-4 text-sm text-muted">Tip para {tip.profiles?.public_name ?? tip.profiles?.username}</p><h1 className="mt-2 text-5xl font-semibold tracking-[-0.06em]">{formatMoney(tip.amount_minor, tip.currency, "es")}</h1><p className="mt-3 text-sm text-muted">Ninguna de estas opciones mueve dinero real.</p></div><MockGateway paymentId={paymentId} /></section></main>;
}
