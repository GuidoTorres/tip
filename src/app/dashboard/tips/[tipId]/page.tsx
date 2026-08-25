import { ArrowLeft, CheckCircle, Clock, XCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { creatorVisibleTipAmount } from "@/features/payments/creator-visible-amount";
import { getTipStatusPresentation } from "@/features/payments/tip-status-presentation";
import type { Currency, TipStatus } from "@/features/payments/types";
import { formatMoney } from "@/lib/i18n";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function TipDetailPage({ params }: { params: Promise<{ tipId: string }> }) {
  const { tipId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("tips").select("id,operation_code,payer_name,message,anonymous,base_amount_minor,amount_minor,currency,platform_fee_minor,gateway_fee_minor,net_amount_minor,status,created_at,confirmed_at,display_amount_usd_minor").eq("id", tipId).eq("creator_id", user.id).single();
  if (!data) notFound();

  const currency = data.currency as Currency;
  const status = getTipStatusPresentation(data.status as TipStatus);
  const StatusIcon = status.tone === "success" ? CheckCircle : status.tone === "danger" ? XCircle : Clock;
  const baseAmountMinor = creatorVisibleTipAmount(data);
  const platformFeeMinor = Number(data.platform_fee_minor);
  const maximumCreatorNet = Math.max(0, baseAmountMinor - platformFeeMinor);
  const creatorNetMinor = Math.min(Number(data.net_amount_minor), maximumCreatorNet);
  const creatorProcessingFeeMinor = Math.max(0, maximumCreatorNet - creatorNetMinor);

  return <div className="mx-auto max-w-xl">
    <Link href="/dashboard/tips" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-foreground"><ArrowLeft /> Volver al historial</Link>
    <section className="mt-4 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <div className={`flex items-center gap-2 text-sm font-semibold ${status.tone === "success" ? "text-success" : status.tone === "danger" ? "text-accent-strong" : "text-warning"}`}><StatusIcon weight="fill" />{status.label}</div>
      <h1 className="mt-5 text-5xl font-semibold tracking-[-0.04em]">{formatMoney(baseAmountMinor, currency, "es")}</h1>
      {data.display_amount_usd_minor && <p className="mt-2 text-sm text-muted">Referencia elegida por el fan: {formatMoney(Number(data.display_amount_usd_minor), "USD", "es")}</p>}
      <p className="mt-3 text-lg font-semibold">{data.anonymous ? "Anónimo" : data.payer_name || "Alguien"}</p>
      <div className="mt-5 border-y border-border py-4"><p className="text-xs font-semibold text-muted">Código de operación</p><p className="mt-1 break-all font-mono text-sm font-bold tracking-[0.04em]">{data.operation_code}</p></div>
      {data.message && <blockquote className="mt-5 rounded-2xl bg-surface-soft p-4 text-muted">“{data.message}”</blockquote>}
      <div className="mt-8 space-y-3 border-t border-border pt-6 text-sm">
        <MoneyRow label="Tip recibido" value={baseAmountMinor} currency={currency} />
        <MoneyRow label="Procesamiento" value={data.gateway_fee_minor === null ? null : -creatorProcessingFeeMinor} currency={currency} />
        <MoneyRow label="TipMe" value={-platformFeeMinor} currency={currency} />
        <MoneyRow label="Tú recibes" value={creatorNetMinor} currency={currency} strong />
      </div>
      {data.gateway_fee_minor === null && <p className="mt-5 rounded-xl bg-surface-soft p-3 text-xs leading-relaxed text-muted">El costo de procesamiento está pendiente de información real del gateway. No se muestra un valor estimado.</p>}
    </section>
  </div>;
}

function MoneyRow({ label, value, currency, strong = false }: { label: string; value: number | null; currency: Currency; strong?: boolean }) {
  return <div className={`flex justify-between gap-4 ${strong ? "pt-2 text-base font-bold" : "text-muted"}`}><span>{label}</span><span>{value === null ? "Pendiente" : formatMoney(value, currency, "es")}</span></div>;
}
