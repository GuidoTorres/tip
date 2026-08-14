import { requireAdmin } from "@/features/admin/guard";

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const [creators, tips, payouts, failed] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "creator"),
    supabase.from("tips").select("id", { count: "exact", head: true }),
    supabase.from("payouts").select("id", { count: "exact", head: true }),
    supabase.from("webhook_events").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);
  return <><h1 className="text-3xl font-semibold tracking-[-0.04em]">Estado general</h1><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Creadores", creators.count], ["Tips", tips.count], ["Retiros", payouts.count], ["Webhooks fallidos", failed.count]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-border bg-surface p-5"><p className="text-sm text-muted">{label}</p><p className="mt-2 text-3xl font-semibold">{value ?? 0}</p></div>)}</div></>;
}
