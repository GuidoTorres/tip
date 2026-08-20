import { redirect } from "next/navigation";
import { BalanceSummary } from "@/components/dashboard/balance-summary";
import { CreatorShareCard } from "@/components/dashboard/creator-share-card";
import { PayPalConnectionBadge } from "@/components/dashboard/paypal-connection-badge";
import { DashboardProfileHeader } from "@/components/dashboard/dashboard-profile-header";
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
  const paymentProvider = serverEnv.PAYMENT_PROVIDER === "paypal" ? "paypal" : "mock";
  const platformPayouts = paymentProvider === "paypal" && serverEnv.PAYPAL_FLOW === "platform_payouts";
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const paymentAccountRequest = platformPayouts
    ? supabase.from("payout_accounts").select("status").eq("creator_id", user.id).eq("provider", "paypal").order("created_at", { ascending: true }).limit(1).maybeSingle()
    : paymentProvider === "paypal"
    ? supabase.from("payment_accounts").select("status,payments_receivable,email_confirmed,onboarding_completed").eq("creator_id", user.id).eq("provider", "paypal").maybeSingle()
    : Promise.resolve({ data: null });
  const tipTotalsRequest = paymentProvider === "paypal"
    ? supabase.rpc("creator_tip_totals", { requested_creator: user.id })
    : Promise.resolve({ data: null });
  const latestTipsBase = supabase.from("tips").select("id,payer_name,message,anonymous,amount_minor,net_amount_minor,currency,status,created_at").eq("creator_id", user.id).order("created_at", { ascending: false });
  const latestTipsRequest = paymentProvider === "paypal"
    ? latestTipsBase.eq("status", "confirmed").limit(6)
    : latestTipsBase.limit(6);
  const [{ data: profile }, { data: balances }, { data: tips }, { data: todayTips }, { data: paymentAccount }, { data: tipTotals }] = await Promise.all([
    supabase.from("profiles").select("public_name,username,avatar_url").eq("id", user.id).single(),
    supabase.rpc("creator_balances", { requested_creator: user.id }),
    latestTipsRequest,
    supabase.from("tips").select("amount_minor,net_amount_minor,currency,status,created_at,confirmed_at").eq("creator_id", user.id).eq("status", "confirmed").gte("confirmed_at", monthStart.toISOString()),
    paymentAccountRequest,
    tipTotalsRequest,
  ]);
  const balance = (balances as Array<{ currency: Currency; available_minor: number; pending_minor: number }> | null)?.find((item) => item.currency === currency);
  const totals = (tipTotals as Array<{ currency: Currency; gross_confirmed_minor: number; platform_fees_minor: number; gateway_fees_minor: number; net_confirmed_minor: number }> | null)?.find((item) => item.currency === currency);
  const confirmedMonth = (todayTips ?? []).filter((tip) => tip.status === "confirmed" && tip.currency === currency);
  const confirmedToday = confirmedMonth.filter((tip) => new Date(tip.confirmed_at ?? tip.created_at) >= todayStart);
  const todayGrossMinor = confirmedToday.reduce((sum, tip) => sum + Number(tip.amount_minor), 0);
  const todayNetMinor = confirmedToday.reduce((sum, tip) => sum + Number(tip.net_amount_minor ?? tip.amount_minor), 0);
  const monthNetMinor = confirmedMonth.reduce((sum, tip) => sum + Number(tip.net_amount_minor ?? tip.amount_minor), 0);
  const publicUrl = profile?.username ? buildPublicProfileUrl(getPublicEnv().NEXT_PUBLIC_APP_URL, profile.username) : null;
  const paypalAccountState = paymentAccount as {
    status?: string;
    payments_receivable?: boolean;
    email_confirmed?: boolean;
    onboarding_completed?: boolean;
  } | null;
  const paypalConnected = platformPayouts
    ? paypalAccountState?.status === "pending" || paypalAccountState?.status === "verified"
    : paymentProvider === "paypal" && paypalAccountState?.status === "connected" && paypalAccountState.payments_receivable === true && paypalAccountState.email_confirmed === true && paypalAccountState.onboarding_completed === true;
  const paypalVerified = platformPayouts && paypalAccountState?.status === "verified";
  const availableMinor = paymentProvider === "paypal" && !platformPayouts ? Number(totals?.net_confirmed_minor ?? 0) : Number(balance?.available_minor ?? 0);
  const feesMinor = Number(totals?.platform_fees_minor ?? 0) + Number(totals?.gateway_fees_minor ?? 0);

  return <><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><DashboardProfileHeader name={profile?.public_name ?? "Tu cuenta"} avatarUrl={profile?.avatar_url ?? null} />{paypalConnected && <PayPalConnectionBadge verified={!platformPayouts || paypalVerified} />}</div><BalanceSummary currency={currency} availableMinor={availableMinor} pendingMinor={Number(balance?.pending_minor ?? 0)} todayMinor={paymentProvider === "paypal" && !platformPayouts ? todayGrossMinor : todayNetMinor} monthMinor={monthNetMinor} grossConfirmedMinor={Number(totals?.gross_confirmed_minor ?? 0)} feesMinor={feesMinor} paymentProvider={paymentProvider} platformPayouts={platformPayouts} sandboxSingleMerchant={serverEnv.PAYPAL_SANDBOX_SINGLE_MERCHANT} shareActions={publicUrl && profile?.username ? <CreatorShareCard publicUrl={publicUrl} username={profile.username} /> : undefined} /><div className="mt-6"><RecentTips tips={(tips ?? []) as RecentTip[]} showAllLink twoColumns /></div></>;
}
