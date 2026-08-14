import { redirect } from "next/navigation";
import { BalanceSummary } from "@/components/dashboard/balance-summary";
import { RecentTips, type RecentTip } from "@/components/dashboard/recent-tips";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/i18n";
import type { Currency } from "@/features/payments/types";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: balances }, { data: tips }] = await Promise.all([
    supabase.from("profiles").select("public_name,preferred_currency").eq("id", user.id).single(),
    supabase.rpc("creator_balances", { requested_creator: user.id }),
    supabase.from("tips").select("id,payer_name,message,anonymous,amount_minor,net_amount_minor,currency,status,created_at").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const currency = (profile?.preferred_currency ?? "USD") as Currency;
  const balance = (balances as Array<{ currency: Currency; available_minor: number; pending_minor: number }> | null)?.find((item) => item.currency === currency);
  const confirmed = (tips ?? []).filter((tip) => tip.status === "confirmed");
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const sumSince = (from: Date) => confirmed.filter((tip) => new Date(tip.created_at) >= from && tip.currency === currency).reduce((sum, tip) => sum + Number(tip.net_amount_minor ?? tip.amount_minor), 0);

  return <><div className="mb-6"><p className="text-sm text-muted">Hola</p><h1 className="text-3xl font-semibold tracking-[-0.04em]">{profile?.public_name ?? "Creadora"}</h1></div><BalanceSummary currency={currency} availableMinor={Number(balance?.available_minor ?? 0)} pendingMinor={Number(balance?.pending_minor ?? 0)} /><section className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-border bg-surface p-4"><p className="text-sm text-muted">Hoy</p><p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{formatMoney(sumSince(todayStart), currency, "es")}</p></div><div className="rounded-2xl border border-border bg-surface p-4"><p className="text-sm text-muted">Este mes</p><p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{formatMoney(sumSince(monthStart), currency, "es")}</p></div></section><RecentTips tips={(tips ?? []) as RecentTip[]} /></>;
}
