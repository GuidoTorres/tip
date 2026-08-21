"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, XCircle } from "@phosphor-icons/react";
import { ReceiptActions } from "@/components/tips/receipt-actions";
import { creatorVisibleTipAmount } from "@/features/payments/creator-visible-amount";
import { getTipStatusPresentation } from "@/features/payments/tip-status-presentation";
import { formatMoney } from "@/lib/i18n";
import type { Currency, TipStatus } from "@/features/payments/types";

type Receipt = {
  id: string;
  status: TipStatus;
  operation_code: string;
  base_amount_minor?: number | null;
  processing_support_minor?: number | null;
  amount_minor: number;
  currency: Currency;
  provider: string;
  message: string | null;
  display_amount_usd_minor?: number | null;
  exchange_rate?: number | null;
  exchange_rate_quoted_at?: string | null;
  profiles: { public_name: string | null; username: string } | null;
};

export function ReceiptStatus({ initial, token }: { initial: Receipt; token: string }) {
  const [tip, setTip] = useState(initial);

  useEffect(() => {
    if (!(["created", "pending"] as TipStatus[]).includes(tip.status)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/tips/${tip.id}/status?token=${encodeURIComponent(token)}`);
      if (response.ok) setTip(await response.json());
    }, 2000);
    return () => window.clearInterval(timer);
  }, [tip.id, tip.status, token]);

  const creator = tip.profiles?.public_name ?? tip.profiles?.username ?? "este perfil";
  const confirmed = tip.status === "confirmed";
  const rejected = tip.status === "rejected";
  const reversed = tip.status === "refunded" || tip.status === "chargeback";
  const status = getTipStatusPresentation(tip.status);
  const baseAmountMinor = creatorVisibleTipAmount(tip);
  const displayAmount = tip.display_amount_usd_minor
    ? formatMoney(tip.display_amount_usd_minor, "USD", "es")
    : formatMoney(baseAmountMinor, tip.currency, "es");
  const processingSupportMinor = Number(tip.processing_support_minor ?? 0);
  const repeatLabel = confirmed ? "Enviar otro tip" : rejected ? "Intentar nuevamente" : null;
  const repeatHref = repeatLabel && tip.profiles?.username ? `/${encodeURIComponent(tip.profiles.username)}` : null;
  const heading = confirmed ? "Tip enviado" : rejected ? "Pago rechazado" : reversed ? "Pago revertido" : "Pago pendiente";
  const description = confirmed ? `Le enviaste a ${creator}` : rejected ? "El pago no fue aprobado." : reversed ? "Este pago ya no está confirmado." : "Estamos esperando la confirmación del gateway.";

  return <div className="text-center">
    {confirmed ? <CheckCircle size={52} weight="fill" className="mx-auto text-success" /> : rejected || reversed ? <XCircle size={52} weight="fill" className="mx-auto text-accent" /> : <Clock size={52} weight="fill" className="mx-auto text-warning" />}
    <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">{heading}</h1>
    <p className="mt-2 text-muted">{description}</p>
    <p className="mt-7 text-5xl font-semibold tracking-[-0.04em]">{displayAmount}</p>
    {tip.display_amount_usd_minor && <p className="mt-2 text-xs text-muted">Procesado como {formatMoney(baseAmountMinor, tip.currency, "es")} según la conversión aplicada al pago.</p>}
    {processingSupportMinor > 0 && <dl className="mt-5 space-y-2 rounded-xl bg-surface-soft p-4 text-sm">
      <div className="flex justify-between gap-4 text-muted"><dt>Aporte al procesamiento</dt><dd>{formatMoney(processingSupportMinor, tip.currency, "es")}</dd></div>
      <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold"><dt>Total pagado</dt><dd>{formatMoney(tip.amount_minor, tip.currency, "es")}</dd></div>
    </dl>}
    <div className="mt-6 border-y border-border py-4">
      <p className="text-xs font-semibold text-muted">Código de operación</p>
      <p className="mt-1 break-all font-mono text-base font-bold tracking-[0.04em]">{tip.operation_code}</p>
      <p className="mt-1 text-xs text-muted">El creador puede verificar este código en su historial de TipMe.</p>
    </div>
    <ReceiptActions tipId={tip.id} token={token} operationCode={tip.operation_code} canShare={confirmed} />
    {tip.message && <blockquote className="mt-6 rounded-2xl bg-surface-soft p-4 text-muted">“{tip.message}”</blockquote>}
    <p className={`mt-6 font-semibold ${status.tone === "success" ? "text-success" : status.tone === "danger" ? "text-accent" : "text-warning"}`}>{status.label}</p>
    {repeatHref && repeatLabel && <div className="mt-7"><a href={repeatHref} className="pressable inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-7 font-semibold text-on-accent">{repeatLabel}</a></div>}
    {confirmed && tip.provider === "paypal" && <p className="mt-6 rounded-xl bg-surface-soft p-3 text-xs leading-relaxed text-muted">Procesado por PayPal. Las disputas y operaciones no autorizadas se gestionan según PayPal y el emisor del medio de pago.</p>}
    <p className="mt-4 text-xs leading-relaxed text-muted">El dashboard de TipMe es la fuente de verdad.</p>
  </div>;
}
