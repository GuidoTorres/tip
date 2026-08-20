import Link from "next/link";
import { CheckCircle, Clock } from "@phosphor-icons/react/dist/ssr";
import { formatDistanceToNow } from "@/lib/time";
import { formatMoney } from "@/lib/i18n";
import { creatorVisibleTipAmount } from "@/features/payments/creator-visible-amount";
import type { Currency, TipStatus } from "@/features/payments/types";

export type RecentTip = {
  id: string;
  payer_name: string | null;
  message: string | null;
  anonymous: boolean;
  base_amount_minor?: number | null;
  amount_minor: number;
  currency: Currency;
  status: TipStatus;
  created_at: string;
};

export function TipList({ tips, separateCards = false }: { tips: RecentTip[]; separateCards?: boolean }) {
  if (tips.length === 0) return <div className="rounded-2xl border border-dashed border-border p-8 text-center"><p className="font-semibold">Tu primer tip aparecerá aquí</p><p className="mt-2 text-sm text-muted">Comparte tu link para comenzar.</p></div>;
  return <div className={separateCards ? "space-y-3" : "overflow-hidden rounded-2xl border border-border bg-surface"}>{tips.map((tip, index) => <Link key={tip.id} href={`/dashboard/tips/${tip.id}`} data-tip-card={separateCards ? true : undefined} className={`flex gap-3 p-3.5 hover:bg-surface-soft ${separateCards ? "rounded-2xl border border-border bg-surface" : index ? "border-t border-border" : ""}`}><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-soft font-bold text-accent">{tip.anonymous ? "A" : (tip.payer_name ?? "A").charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-3"><p className="truncate font-semibold">{tip.anonymous ? "Anónimo" : tip.payer_name || "Alguien"}</p><p className="shrink-0 font-bold">{formatMoney(creatorVisibleTipAmount(tip), tip.currency, "es")}</p></div>{tip.message && <p className="mt-1 truncate text-sm text-muted">“{tip.message}”</p>}<p className={`mt-1.5 flex items-center gap-1 text-xs font-semibold ${tip.status === "confirmed" ? "text-success" : "text-warning"}`}>{tip.status === "confirmed" ? <CheckCircle weight="fill" /> : <Clock weight="fill" />}{tip.status === "confirmed" ? "Confirmado" : "Pendiente"} · {formatDistanceToNow(tip.created_at)}</p></div></Link>)}</div>;
}

export function RecentTips({ tips, showAllLink = false, twoColumns = false }: { tips: RecentTip[]; showAllLink?: boolean; twoColumns?: boolean }) {
  const splitIntoCards = twoColumns && tips.length > 3;
  return <section><div className="mb-3 flex items-center justify-between gap-4"><h2 className="text-xl font-semibold tracking-[-0.03em]">Últimos tips</h2>{showAllLink && tips.length > 0 && <Link href="/dashboard/tips" className="text-sm font-semibold text-accent hover:text-accent-strong">Ver todos</Link>}</div>{splitIntoCards ? <><div aria-label="Últimos cinco tips" className="sm:hidden"><TipList tips={tips.slice(0, 5)} separateCards /></div><div className="hidden gap-4 sm:grid sm:grid-cols-2"><div aria-label="Tips recientes, columna izquierda"><TipList tips={tips.slice(0, 3)} separateCards /></div><div aria-label="Tips recientes, columna derecha"><TipList tips={tips.slice(3, 6)} separateCards /></div></div></> : <TipList tips={tips} />}</section>;
}
