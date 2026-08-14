import { requireAdmin } from "@/features/admin/guard";

export default async function AdminCreatorsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("profiles").select("id,public_name,username,country,preferred_currency,onboarding_completed,created_at").eq("role", "creator").order("created_at", { ascending: false }).limit(100);
  return <AdminList title="Creadores" empty="No hay creadores.">{data?.map((item) => <div key={item.id} className="grid gap-1 p-4 sm:grid-cols-[1fr_1fr_auto]"><strong>{item.public_name ?? "Sin nombre"}</strong><span className="text-sm text-muted">@{item.username ?? "sin-username"}</span><span className="text-sm text-muted">{item.country ?? "--"} · {item.preferred_currency} · {item.onboarding_completed ? "Activo" : "Onboarding"}</span></div>)}</AdminList>;
}

function AdminList({ title, empty, children }: { title: string; empty: string; children?: React.ReactNode }) {
  return <><h1 className="text-3xl font-semibold tracking-[-0.04em]">{title}</h1><div className="mt-7 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">{children || <p className="p-6 text-muted">{empty}</p>}</div></>;
}

