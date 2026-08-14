import { requireAdmin } from "@/features/admin/guard";
import { formatMoney } from "@/lib/i18n";
import type { Currency } from "@/features/payments/types";

export default async function AdminPayoutsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("payouts").select("id,creator_id,amount_minor,currency,status,provider,provider_payout_id,created_at").order("created_at", { ascending: false }).limit(100);
  return <><h1 className="text-3xl font-semibold tracking-[-0.04em]">Retiros</h1><div className="mt-7 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">{!data?.length ? <p className="p-6 text-muted">No hay retiros.</p> : data.map((item) => <div key={item.id} className="grid gap-1 p-4 sm:grid-cols-[1fr_auto_auto]"><span className="truncate text-sm text-muted">{item.provider_payout_id ?? item.id}</span><strong>{formatMoney(Number(item.amount_minor), item.currency as Currency, "es")}</strong><span className="text-sm font-semibold">{item.status}</span></div>)}</div></>;
}

