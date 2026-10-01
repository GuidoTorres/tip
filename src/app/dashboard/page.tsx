import { redirect } from "next/navigation";
import { BalanceRefreshButton } from "@/components/dashboard/balance-refresh-button";
import { BalanceSummary } from "@/components/dashboard/balance-summary";
import { ComplianceStatusCard } from "@/components/dashboard/compliance-status-card";
import { CreatorShareCard } from "@/components/dashboard/creator-share-card";
import { DashboardProfileHeader } from "@/components/dashboard/dashboard-profile-header";
import { PayPalActivationCard } from "@/components/dashboard/paypal-activation-card";
import { PayPalConnectionBadge } from "@/components/dashboard/paypal-connection-badge";
import { RecentTips, type RecentTip } from "@/components/dashboard/recent-tips";
import { APPLICATION_CURRENCY } from "@/features/payments/application-currency";
import { creatorVisibleTipAmount } from "@/features/payments/creator-visible-amount";
import type { Currency } from "@/features/payments/types";
import { buildPublicProfileUrl } from "@/features/profiles/public-url";
import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serverEnv = getServerEnv();
  const currency = APPLICATION_CURRENCY;
  const platformPayouts = serverEnv.PAYPAL_FLOW === "platform_payouts";
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const paymentAccountRequest = platformPayouts
    ? supabase.from("payout_accounts").select("status,provider_account_id,bank_name").eq("creator_id", user.id).eq("provider", "paypal").maybeSingle()
    : supabase.from("payment_accounts").select("status,payments_receivable,email_confirmed,onboarding_completed").eq("creator_id", user.id).eq("provider", "paypal").maybeSingle();

  const [{ data: profile }, { data: balances }, { data: tips }, { data: recentConfirmedTips }, { data: paymentAccount }, { data: tipTotals }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.rpc("creator_balances", { requested_creator: user.id }),
    supabase.from("tips").select("id,payer_name,message,anonymous,base_amount_minor,amount_minor,net_amount_minor,currency,status,created_at").eq("creator_id", user.id).eq("status", "confirmed").order("created_at", { ascending: false }).limit(6),
    supabase.from("tips").select("base_amount_minor,amount_minor,net_amount_minor,currency,status,created_at,confirmed_at").eq("creator_id", user.id).eq("status", "confirmed").gte("confirmed_at", monthStart.toISOString()),
    paymentAccountRequest,
    supabase.rpc("creator_tip_totals", { requested_creator: user.id }),
  ]);

  const balance = (balances as Array<{ currency: Currency; available_minor: number; pending_minor: number }> | null)?.find((item) => item.currency === currency);
  const totals = (tipTotals as Array<{ currency: Currency; gross_confirmed_minor: number; platform_fees_minor: number; gateway_fees_minor: number; net_confirmed_minor: number }> | null)?.find((item) => item.currency === currency);
  const confirmedMonth = (recentConfirmedTips ?? []).filter((tip) => tip.status === "confirmed" && tip.currency === currency);
  const confirmedToday = confirmedMonth.filter((tip) => new Date(tip.confirmed_at ?? tip.created_at) >= todayStart);
  const todayGrossMinor = confirmedToday.reduce((sum, tip) => sum + creatorVisibleTipAmount(tip), 0);
  const monthGrossMinor = confirmedMonth.reduce((sum, tip) => sum + creatorVisibleTipAmount(tip), 0);
  const publicUrl = profile?.username ? buildPublicProfileUrl(getPublicEnv().NEXT_PUBLIC_APP_URL, profile.username) : null;
  const paypalAccountState = paymentAccount as {
    status?: string;
    payments_receivable?: boolean;
    onboarding_completed?: boolean;
  } | null;
  const paypalConnected = platformPayouts
    ? paypalAccountState?.status === "pending" || paypalAccountState?.status === "verified"
    : paypalAccountState?.status === "connected" && paypalAccountState.payments_receivable === true && paypalAccountState.onboarding_completed === true;
  const availableMinor = platformPayouts ? Number(balance?.available_minor ?? 0) : Number(totals?.net_confirmed_minor ?? 0);
  const feesMinor = Number(totals?.platform_fees_minor ?? 0) + Number(totals?.gateway_fees_minor ?? 0);

  return <>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <DashboardProfileHeader name={profile?.public_name ?? "Tu cuenta"} avatarUrl={profile?.avatar_url ?? null} />
      {paypalConnected && <PayPalConnectionBadge verified={!platformPayouts || paypalAccountState?.status === "verified"} />}
    </div>
    <ComplianceStatusCard status={profile?.payment_review_status ?? "pending"} reason={profile?.payment_review_reason ?? null} />
    {!paypalConnected && <PayPalActivationCard connected={false} verified={false} payoutEmail={platformPayouts} />}
    <BalanceSummary
      currency={currency}
      availableMinor={availableMinor}
      pendingMinor={Number(balance?.pending_minor ?? 0)}
      todayMinor={todayGrossMinor}
      monthMinor={monthGrossMinor}
      grossConfirmedMinor={Number(totals?.gross_confirmed_minor ?? 0)}
      feesMinor={feesMinor}
      paymentProvider="paypal"
      platformPayouts={platformPayouts}
      sandboxSingleMerchant={serverEnv.PAYPAL_SANDBOX_SINGLE_MERCHANT}
      shareActions={publicUrl && profile?.username ? <CreatorShareCard publicUrl={publicUrl} username={profile.username} /> : undefined}
      refreshAction={<BalanceRefreshButton />}
    />
    <div className="mt-6"><RecentTips tips={(tips ?? []) as RecentTip[]} showAllLink twoColumns /></div>
  </>;
}
