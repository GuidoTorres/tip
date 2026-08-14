import Link from "next/link";
import { CheckCircle, Clock } from "@phosphor-icons/react/dist/ssr";
import { formatDistanceToNow } from "@/lib/time";
import { formatMoney } from "@/lib/i18n";
import type { Currency, TipStatus } from "@/features/payments/types";

export type RecentTip = { id: string; payer_name: string | null; message: string | null; anonymous: boolean; amount_minor: number; currency: Currency; status: TipStatus; created_at: string };

export function RecentTips({ tips }: { tips: RecentTip[] }) {
  return <section className="mt-8"><h2 className="text-xl font-semibold tracking-[-0.03em]">Últimos tips</h2>{tips.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center"><p className="font-semibold">Tu primer tip aparecerá aquí</p><p className="mt-2 text-sm text-muted">Comparte tu link para comenzar.</p></div> : <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">{tips.map((tip, index) => <Link key={tip.id} href={`/dashboard/tips/${tip.id}`} className={`flex gap-4 p-4 hover:bg-surface-soft ${index ? "border-t border-border" : ""}`}><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-soft font-bold text-accent">{tip.anonymous ? "A" : (tip.payer_name ?? "A").charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-3"><p className="truncate font-semibold">{tip.anonymous ? "Anónimo" : tip.payer_name || "Alguien"}</p><p className="shrink-0 font-bold">{formatMoney(tip.amount_minor, tip.currency, "es")}</p></div>{tip.message && <p className="mt-1 truncate text-sm text-muted">“{tip.message}”</p>}<p className={`mt-2 flex items-center gap-1 text-xs font-semibold ${tip.status === "confirmed" ? "text-success" : "text-warning"}`}>{tip.status === "confirmed" ? <CheckCircle weight="fill" /> : <Clock weight="fill" />}{tip.status === "confirmed" ? "Confirmado" : "Pendiente"} · {formatDistanceToNow(tip.created_at)}</p></div></Link>)}</div>}</section>;
}

