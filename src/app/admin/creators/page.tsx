import { requireAdmin } from "@/features/admin/guard";
import { reviewCreatorPolicyAction } from "@/features/compliance/actions";

export default async function AdminCreatorsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("profiles").select("id,public_name,username,country,preferred_currency,onboarding_completed,social_url,content_category,payment_review_status,payment_review_reason,created_at").eq("role", "creator").order("created_at", { ascending: false }).limit(100);
  return <AdminList title="Revisión de creadores" empty="No hay perfiles.">{data?.map((item) => <article key={item.id} className="space-y-4 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><strong>{item.public_name ?? "Sin nombre"}</strong><p className="text-sm text-muted">@{item.username ?? "sin-username"} · {item.content_category ?? "Sin categoría"}</p></div>
      <span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold">{reviewLabel(item.payment_review_status)}</span>
    </div>
    {item.social_url && <a href={item.social_url} target="_blank" rel="noreferrer" className="block break-all text-sm font-semibold text-accent-strong underline">{item.social_url}</a>}
    {item.payment_review_reason && <p className="text-sm text-muted">Última decisión: {item.payment_review_reason}</p>}
    <form action={reviewCreatorPolicyAction} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <input type="hidden" name="creatorId" value={item.id} />
      <input name="reason" required minLength={3} maxLength={500} placeholder="Motivo de la revisión" className="min-h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-accent" />
      <button name="status" value="approved" className="min-h-11 rounded-full bg-success px-5 text-sm font-bold text-white">Aprobar</button>
      <button name="status" value="rejected" className="min-h-11 rounded-full border border-border px-5 text-sm font-bold text-accent-strong">Rechazar</button>
    </form>
  </article>)}</AdminList>;
}

function reviewLabel(status: string | null) {
  if (status === "approved") return "Aprobado";
  if (status === "rejected") return "Rechazado";
  if (status === "suspended") return "Suspendido";
  return "Pendiente";
}

function AdminList({ title, empty, children }: { title: string; empty: string; children?: React.ReactNode }) {
  return <><h1 className="text-3xl font-semibold tracking-[-0.04em]">{title}</h1><div className="mt-7 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">{children || <p className="p-6 text-muted">{empty}</p>}</div></>;
}
