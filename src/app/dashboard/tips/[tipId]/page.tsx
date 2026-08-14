import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle, Clock } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/i18n";
import type { Currency } from "@/features/payments/types";

export default async function TipDetailPage({ params }: { params: Promise<{ tipId: string }> }) {
  const { tipId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("tips").select("id,payer_name,message,anonymous,amount_minor,currency,platform_fee_minor,gateway_fee_minor,net_amount_minor,status,created_at,confirmed_at").eq("id", tipId).eq("creator_id", user.id).single();
  if (!data) notFound();
  const currency = data.currency as Currency;
  return <div className="mx-auto max-w-xl"><Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-foreground"><ArrowLeft /> Volver</Link><section className="mt-6 rounded-2xl border border-border bg-surface p-6 sm:p-8"><div className="flex items-center gap-2 text-sm font-semibold text-muted">{data.status === "confirmed" ? <CheckCircle className="text-success" weight="fill" /> : <Clock className="text-warning" weight="fill" />}{data.status === "confirmed" ? "Confirmado" : "Pendiente"}</div><h1 className="mt-5 text-5xl font-semibold tracking-[-0.06em]">{formatMoney(Number(data.amount_minor), currency, "es")}</h1><p className="mt-3 text-lg font-semibold">{data.anonymous ? "Anónimo" : data.payer_name || "Alguien"}</p>{data.message && <blockquote className="mt-5 rounded-2xl bg-surface-soft p-4 text-muted">“{data.message}”</blockquote>}<div className="mt-8 space-y-3 border-t border-border pt-6 text-sm"><MoneyRow label="Tip recibido" value={Number(data.amount_minor)} currency={currency} /><MoneyRow label="Procesamiento" value={data.gateway_fee_minor === null ? null : -Number(data.gateway_fee_minor)} currency={currency} /><MoneyRow label="TipMe" value={-Number(data.platform_fee_minor)} currency={currency} /><MoneyRow label="Tú recibes" value={Number(data.net_amount_minor)} currency={currency} strong /></div>{data.gateway_fee_minor === null && <p className="mt-5 rounded-xl bg-surface-soft p-3 text-xs leading-relaxed text-muted">El costo de procesamiento está pendiente de información real del gateway. No se muestra un valor estimado.</p>}</section></div>;
}

function MoneyRow({ label, value, currency, strong = false }: { label: string; value: number | null; currency: Currency; strong?: boolean }) {
  return <div className={`flex justify-between gap-4 ${strong ? "pt-2 text-base font-bold" : "text-muted"}`}><span>{label}</span><span>{value === null ? "Pendiente" : formatMoney(value, currency, "es")}</span></div>;
}

