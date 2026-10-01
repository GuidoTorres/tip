import { paymentTimingLabels, type PaymentTimingEntry } from "@/features/payments/payment-timing";
import type { Locale } from "@/lib/i18n/config";

function formatDuration(durationMs: number) {
  return durationMs < 1_000 ? `${durationMs} ms` : `${(Math.round(durationMs / 10) / 100).toFixed(2)} s`;
}

export function PaymentTimingPanel({ entries, locale }: { entries: PaymentTimingEntry[]; locale: Locale }) {
  if (!entries.length) return null;
  const es = locale === "es";
  const technicalEntries = entries.filter((entry) => entry.durationMs !== null && !["paypal_interaction", "card_authorization"].includes(entry.stage));
  const slowest = technicalEntries.reduce<PaymentTimingEntry | null>((current, entry) => (
    !current || Number(entry.durationMs) > Number(current.durationMs) ? entry : current
  ), null);

  return <section data-payment-diagnostics="true" className="mt-5 border-t border-border pt-4" aria-live="polite">
    <div className="flex items-center gap-2">
      <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
      <h3 className="text-sm font-semibold">{es ? "Diagnóstico de pago" : "Payment diagnostics"}</h3>
      <span className="ml-auto rounded-full bg-surface-soft px-2.5 py-1 text-[11px] font-semibold text-muted">DEBUG</span>
    </div>
    <p className="mt-2 text-xs leading-relaxed text-muted">{es ? "Solo aparece porque la URL incluye debugPayments=1." : "Only visible because the URL includes debugPayments=1."}</p>
    <ol className="mt-3 divide-y divide-border">
      {entries.map((entry) => {
        const pending = entry.status === "pending";
        const failed = entry.status === "failed";
        const canceled = entry.status === "canceled";
        const timedOut = entry.status === "timeout";
        return <li key={entry.stage} className="flex min-h-10 items-center gap-3 py-2 text-sm">
          <span className="min-w-0 flex-1">{paymentTimingLabels[entry.stage]}</span>
          {slowest?.stage === entry.stage && !pending && <span className="rounded-full bg-warning/10 px-2 py-1 text-[11px] font-semibold text-warning">{es ? "Más lento" : "Slowest"}</span>}
          <span className={`shrink-0 font-mono text-xs font-semibold ${failed || timedOut ? "text-accent-strong" : canceled ? "text-warning" : "text-muted"}`}>
            {pending ? (es ? "Midiendo…" : "Measuring…") : entry.durationMs === null ? "—" : formatDuration(entry.durationMs)}
          </span>
        </li>;
      })}
    </ol>
  </section>;
}
