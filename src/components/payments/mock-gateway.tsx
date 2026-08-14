"use client";

import { useState } from "react";
import { CheckCircle, Clock, XCircle } from "@phosphor-icons/react";

const actions = [
  { status: "confirmed", label: "Simular pago aprobado", icon: CheckCircle, className: "bg-accent text-on-accent" },
  { status: "pending", label: "Simular pago pendiente", icon: Clock, className: "border border-border bg-surface" },
  { status: "rejected", label: "Simular pago rechazado", icon: XCircle, className: "border border-border bg-surface" },
] as const;

export function MockGateway({ paymentId }: { paymentId: string }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState(false);
  async function simulate(status: typeof actions[number]["status"]) {
    setLoading(status); setError(false);
    try {
      const response = await fetch(`/api/mock/payments/${encodeURIComponent(paymentId)}/simulate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign(data.receiptUrl);
    } catch { setError(true); setLoading(null); }
  }
  return <div className="mt-7 space-y-3">{actions.map(({ status, label, icon: Icon, className }) => <button key={status} type="button" disabled={Boolean(loading)} onClick={() => simulate(status)} className={`pressable flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-5 font-bold disabled:opacity-60 ${className}`}><Icon size={21} weight="fill" />{loading === status ? "Procesando..." : label}</button>)}{error && <p role="alert" className="text-center text-sm text-accent-strong">No pudimos ejecutar la simulación.</p>}</div>;
}

