"use client";

import { useState } from "react";
import { CheckCircle, SpinnerGap } from "@phosphor-icons/react";
import Link from "next/link";

export function MercadoPagoConnect({ connected, country }: { connected: boolean; country?: string | null }) {
  const [selectedCountry, setSelectedCountry] = useState<"MX" | "CO">(country === "CO" ? "CO" : "MX");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  if (connected) return <div className="rounded-2xl bg-surface-soft p-5"><strong className="flex items-center gap-2 text-success"><CheckCircle size={21} weight="fill" /> Mercado Pago conectado</strong><p className="mt-1 text-sm text-muted">Los tips llegarán directamente a tu cuenta en {country === "CO" ? "COP" : "MXN"}.</p><Link href="/onboarding?step=3" className="pressable mt-5 flex min-h-12 items-center justify-center rounded-full bg-accent px-5 font-bold text-on-accent">Continuar</Link></div>;

  async function connect() {
    setLoading(true); setError(false);
    try {
      const response = await fetch("/api/mercadopago/oauth/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ country: selectedCountry }) });
      const data = await response.json() as { actionUrl?: string };
      if (!response.ok || !data.actionUrl) throw new Error("unavailable");
      window.location.assign(data.actionUrl);
    } catch { setLoading(false); setError(true); }
  }

  return <div><label className="block text-sm font-semibold">País de tu cuenta Mercado Pago<select value={selectedCountry} onChange={(event) => setSelectedCountry(event.target.value as "MX" | "CO")} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4"><option value="MX">México · MXN</option><option value="CO">Colombia · COP</option></select></label><p className="mt-3 text-sm text-muted">Debes conectar una cuenta del mismo país. Mercado Pago verificará tu identidad y administrará tus retiros.</p><button type="button" disabled={loading} onClick={connect} className="pressable mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#009ee3] px-6 font-bold text-white disabled:opacity-60">{loading && <SpinnerGap className="animate-spin" />} Conectar Mercado Pago</button>{error && <p role="alert" className="mt-3 text-sm font-semibold text-accent-strong">No pudimos iniciar la conexión. Inténtalo nuevamente.</p>}</div>;
}
