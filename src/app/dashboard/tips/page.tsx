import { MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TipList, type RecentTip } from "@/components/dashboard/recent-tips";
import { normalizeOperationCode } from "@/features/payments/operation-code";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function TipsHistoryPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const queryValue = (await searchParams).q;
  const rawQuery = (Array.isArray(queryValue) ? queryValue[0] : queryValue ?? "").trim();
  const searched = rawQuery.length > 0;
  const operationCode = searched ? normalizeOperationCode(rawQuery) : null;
  let tips: RecentTip[] = [];

  if (!searched || operationCode) {
    let query = supabase.from("tips")
      .select("id,payer_name,message,anonymous,operation_code,base_amount_minor,amount_minor,currency,status,created_at")
      .eq("creator_id", user.id);
    if (operationCode) query = query.eq("operation_code", operationCode);
    const { data } = await query.order("created_at", { ascending: false }).limit(operationCode ? 1 : 50);
    tips = (data ?? []) as RecentTip[];
  }

  return <div className="mx-auto max-w-2xl">
    <h1 className="text-3xl font-semibold tracking-[-0.04em]">Historial de tips</h1>
    <p className="mt-2 text-muted">Busca el código del comprobante o revisa tus 50 tips más recientes.</p>
    <form action="/dashboard/tips" method="get" role="search" className="mt-6 flex gap-2">
      <label htmlFor="operation-code" className="sr-only">Código de operación</label>
      <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-4 focus-within:border-accent">
        <MagnifyingGlass className="shrink-0 text-muted" size={20} />
        <input id="operation-code" name="q" defaultValue={rawQuery} maxLength={24} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="TM-7A4F-91C2-D8B0-1234" className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none" />
      </div>
      <button type="submit" className="pressable min-h-12 rounded-xl bg-accent px-5 font-semibold text-on-accent">Buscar</button>
    </form>
    {searched && <div className="mt-3 flex items-center justify-between gap-3 text-sm"><p className="text-muted">Verificación por código exacto</p><Link href="/dashboard/tips" className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent"><X size={17} /> Limpiar</Link></div>}
    <div className="mt-5">
      {searched && !operationCode ? <SearchMessage>El formato del código no es válido.</SearchMessage>
        : searched && tips.length === 0 ? <SearchMessage>No encontramos ese código entre tus operaciones.</SearchMessage>
        : <TipList tips={tips} showOperationCode />}
    </div>
    {searched && tips.length === 1 && <p className="mt-4 text-sm text-muted">Comprueba el estado mostrado en TipMe. Una captura por sí sola no confirma el pago.</p>}
  </div>;
}

function SearchMessage({ children }: { children: React.ReactNode }) {
  return <div role="status" className="rounded-xl border border-border bg-surface p-6 text-center"><p className="font-semibold">{children}</p><p className="mt-2 text-sm text-muted">Revisa el código completo e inténtalo nuevamente.</p></div>;
}
