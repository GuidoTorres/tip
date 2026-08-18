import { redirect } from "next/navigation";
import { BalanceSummary } from "@/components/dashboard/balance-summary";
import { CreatorShareCard } from "@/components/dashboard/creator-share-card";
import { PayPalConnectionBadge } from "@/components/dashboard/paypal-connection-badge";
import { RecentTips, type RecentTip } from "@/components/dashboard/recent-tips";
import { buildPublicProfileUrl } from "@/features/profiles/public-url";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import type { Currency } from "@/features/payments/types";
import { APPLICATION_CURRENCY } from "@/features/payments/application-currency";
import { getServerEnv } from "@/lib/env/server";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const serverEnv = getServerEnv();
  const currency: Currency = APPLICATION_CURRENCY;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const paymentAccountRequest = serverEnv.PAYMENT_PROVIDER === "paypal"
    ? supabase.from("payment_accounts").select("status,payments_receivable,email_confirmed,onboarding_completed").eq("creator_id", user.id).eq("provider", "paypal").maybeSingle()
    : Promise.resolve({ data: null });
  const [{ data: profile }, { data: balances }, { data: tips }, { data: periodTips }, { data: paymentAccount }] = await Promise.all([
    supabase.from("profiles").select("public_name,username").eq("id", user.id).single(),
    supabase.rpc("creator_balances", { requested_creator: user.id }),
    supabase.from("tips").select("id,payer_name,message,anonymous,amount_minor,net_amount_minor,currency,status,created_at").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("tips").select("amount_minor,net_amount_minor,currency,status,created_at").eq("creator_id", user.id).eq("status", "confirmed").gte("created_at", monthStart.toISOString()),
    paymentAccountRequest,
  ]);
  const balance = (balances as Array<{ currency: Currency; available_minor: number; pending_minor: number }> | null)?.find((item) => item.currency === currency);
  const confirmed = (periodTips ?? []).filter((tip) => tip.status === "confirmed");
  const sumSince = (from: Date) => confirmed.filter((tip) => new Date(tip.created_at) >= from && tip.currency === currency).reduce((sum, tip) => sum + Number(tip.net_amount_minor ?? tip.amount_minor), 0);
  const publicUrl = profile?.username ? buildPublicProfileUrl(getPublicEnv().NEXT_PUBLIC_APP_URL, profile.username) : null;
  const paymentProvider = serverEnv.PAYMENT_PROVIDER === "paypal" ? "paypal" : "mock";
  const paypalConnected = paymentProvider === "paypal" && paymentAccount?.status === "connected" && paymentAccount.payments_receivable === true && paymentAccount.email_confirmed === true && paymentAccount.onboarding_completed === true;

  return <><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted">Hola</p><h1 className="text-3xl font-semibold tracking-[-0.04em]">{profile?.public_name ?? "Tu cuenta"}</h1></div>{paypalConnected && <PayPalConnectionBadge />}</div><BalanceSummary currency={currency} availableMinor={Number(balance?.available_minor ?? 0)} pendingMinor={Number(balance?.pending_minor ?? 0)} todayMinor={sumSince(todayStart)} monthMinor={sumSince(monthStart)} paymentProvider={paymentProvider} sandboxSingleMerchant={serverEnv.PAYPAL_SANDBOX_SINGLE_MERCHANT} shareActions={publicUrl && profile?.username ? <CreatorShareCard publicUrl={publicUrl} username={profile.username} /> : undefined} /><div className="mt-6"><RecentTips tips={(tips ?? []) as RecentTip[]} showAllLink twoColumns /></div></>;
}
