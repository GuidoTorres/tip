import { redirect } from "next/navigation";
import { BalanceSummary } from "@/components/dashboard/balance-summary";
import { CreatorShareCard } from "@/components/dashboard/creator-share-card";
import { RecentTips, type RecentTip } from "@/components/dashboard/recent-tips";
import { buildPublicProfileUrl } from "@/features/profiles/public-url";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { formatMoney } from "@/lib/i18n";
import type { Currency } from "@/features/payments/types";
import { APPLICATION_CURRENCY } from "@/features/payments/application-currency";
import { getServerEnv } from "@/lib/env/server";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: balances }, { data: tips }] = await Promise.all([
    supabase.from("profiles").select("public_name,username").eq("id", user.id).single(),
    supabase.rpc("creator_balances", { requested_creator: user.id }),
    supabase.from("tips").select("id,payer_name,message,anonymous,amount_minor,net_amount_minor,currency,status,created_at").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const currency: Currency = APPLICATION_CURRENCY;
  const balance = (balances as Array<{ currency: Currency; available_minor: number; pending_minor: number }> | null)?.find((item) => item.currency === currency);
  const confirmed = (tips ?? []).filter((tip) => tip.status === "confirmed");
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const sumSince = (from: Date) => confirmed.filter((tip) => new Date(tip.created_at) >= from && tip.currency === currency).reduce((sum, tip) => sum + Number(tip.net_amount_minor ?? tip.amount_minor), 0);
  const publicUrl = profile?.username ? buildPublicProfileUrl(getPublicEnv().NEXT_PUBLIC_APP_URL, profile.username) : null;
  const serverEnv = getServerEnv();
  const paymentProvider = serverEnv.PAYMENT_PROVIDER === "paypal" ? "paypal" : "mock";

  return <><div className="mb-6"><p className="text-sm text-muted">Hola</p><h1 className="text-3xl font-semibold tracking-[-0.04em]">{profile?.public_name ?? "Tu cuenta"}</h1></div><BalanceSummary currency={currency} availableMinor={Number(balance?.available_minor ?? 0)} pendingMinor={Number(balance?.pending_minor ?? 0)} paymentProvider={paymentProvider} sandboxSingleMerchant={serverEnv.PAYPAL_SANDBOX_SINGLE_MERCHANT} />{publicUrl && profile?.username && <CreatorShareCard publicUrl={publicUrl} username={profile.username} />}<section className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-border bg-surface p-4"><p className="text-sm text-muted">Hoy</p><p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{formatMoney(sumSince(todayStart), currency, "es")}</p></div><div className="rounded-2xl border border-border bg-surface p-4"><p className="text-sm text-muted">Este mes</p><p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{formatMoney(sumSince(monthStart), currency, "es")}</p></div></section><RecentTips tips={(tips ?? []) as RecentTip[]} /></>;
}
