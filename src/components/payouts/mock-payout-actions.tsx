"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MockPayoutActions({ payoutId, status }: { payoutId: string; status: string }) {
  const router = useRouter(); const [loading, setLoading] = useState<string | null>(null);
  const next = status === "requested" ? ["processing", "failed"] : ["completed", "failed"];
  async function simulate(value: string) {
    setLoading(value);
    const response = await fetch(`/api/mock/payouts/${payoutId}/simulate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: value }) });
    setLoading(null); if (response.ok) router.refresh();
  }
  return <div className="ml-auto flex gap-2">{next.map((value) => <button key={value} type="button" disabled={Boolean(loading)} onClick={() => simulate(value)} className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50">{loading === value ? "..." : value === "processing" ? "Procesar" : value === "completed" ? "Completar" : "Fallar"}</button>)}</div>;
}

