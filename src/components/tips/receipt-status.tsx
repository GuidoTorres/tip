"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, ShareNetwork, XCircle } from "@phosphor-icons/react";
import { formatMoney } from "@/lib/i18n";
import type { Currency, TipStatus } from "@/features/payments/types";

type Receipt = { id: string; status: TipStatus; amount_minor: number; currency: Currency; message: string | null; profiles: { public_name: string | null; username: string } | null };

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
  const repeatLabel = confirmed ? "Enviar otro tip" : rejected ? "Intentar nuevamente" : null;
  const repeatHref = repeatLabel && tip.profiles?.username
    ? `/${encodeURIComponent(tip.profiles.username)}`
    : null;
  async function share() {
    if (navigator.share) await navigator.share({ title: "Tip enviado con TipMe", text: `Envié un tip a ${creator} con TipMe.`, url: window.location.origin });
    else await navigator.clipboard.writeText(window.location.origin);
  }
  return <div className="text-center">{confirmed ? <CheckCircle size={52} weight="fill" className="mx-auto text-success" /> : rejected ? <XCircle size={52} weight="fill" className="mx-auto text-accent" /> : <Clock size={52} weight="fill" className="mx-auto text-warning" />}<h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">{confirmed ? "Tip enviado" : rejected ? "Pago rechazado" : "Pago pendiente"}</h1><p className="mt-2 text-muted">{confirmed ? `Le enviaste a ${creator}` : rejected ? "El pago no fue aprobado." : "Estamos esperando la confirmación del gateway."}</p><p className="mt-7 text-5xl font-semibold tracking-[-0.06em]">{formatMoney(tip.amount_minor, tip.currency, "es")}</p>{tip.message && <blockquote className="mt-6 rounded-2xl bg-surface-soft p-4 text-muted">“{tip.message}”</blockquote>}<p className={`mt-6 font-semibold ${confirmed ? "text-success" : rejected ? "text-accent" : "text-warning"}`}>{confirmed ? "Pago confirmado" : rejected ? "No confirmado" : "Confirmación pendiente"}</p>{repeatHref && repeatLabel && <div className="mt-7 flex flex-col items-center gap-3"><a href={repeatHref} className="pressable inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-7 font-semibold text-on-accent">{repeatLabel}</a>{confirmed && <button type="button" onClick={share} className="pressable inline-flex min-h-12 items-center gap-2 rounded-full border border-border px-6 font-semibold"><ShareNetwork size={20} /> Compartir</button>}</div>}<p className="mt-6 text-xs leading-relaxed text-muted">El dashboard de TipMe es la fuente de verdad.</p></div>;
}
