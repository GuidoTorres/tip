import { redirect } from "next/navigation";
import { BalanceSummary } from "@/components/dashboard/balance-summary";
import { BalanceRefreshButton } from "@/components/dashboard/balance-refresh-button";
import { CreatorShareCard } from "@/components/dashboard/creator-share-card";
import { DashboardProfileHeader } from "@/components/dashboard/dashboard-profile-header";
import { RecentTips, type RecentTip } from "@/components/dashboard/recent-tips";
import { buildPublicProfileUrl } from "@/features/profiles/public-url";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import type { Currency } from "@/features/payments/types";
import { APPLICATION_CURRENCY } from "@/features/payments/application-currency";
import { supportedCurrencies } from "@/features/payments/types";
import { getServerEnv } from "@/lib/env/server";
import { MercadoPagoConnectionBadge } from "@/components/dashboard/mercadopago-connection-badge";
import { PayPalConnectionBadge } from "@/components/dashboard/paypal-connection-badge";
import { WhopActivationCard } from "@/components/dashboard/whop-activation-card";
import { PayPalActivationCard } from "@/components/dashboard/paypal-activation-card";
import { creatorVisibleTipAmount } from "@/features/payments/creator-visible-amount";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const serverEnv = getServerEnv();
  const paymentProvider: "mock" | "paypal" | "mercadopago" = serverEnv.PAYMENT_PROVIDER === "paypal" ? "paypal" : serverEnv.PAYMENT_PROVIDER === "mercadopago" ? "mercadopago" : "mock";
  const { data: whopAccount } = serverEnv.PAYMENT_PROVIDER === "whop"
    ? await supabase.from("payment_accounts").select("status,onboarding_completed,payments_receivable").eq("creator_id", user.id).eq("provider", "whop").maybeSingle()
    : { data: null };
  const whopConnected = serverEnv.PAYMENT_PROVIDER === "whop" && whopAccount?.status === "connected" && whopAccount.onboarding_completed === true && whopAccount.payments_receivable === true;
  const { data: mercadoPagoAccount } = paymentProvider === "mercadopago"
    ? await supabase.from("payment_accounts").select("status,provider_currency,provider_country,onboarding_completed,payments_receivable").eq("creator_id", user.id).eq("provider", "mercadopago").maybeSingle()
    : { data: null };
  const currency: Currency = mercadoPagoAccount?.provider_currency && supportedCurrencies.includes(mercadoPagoAccount.provider_currency as Currency)
    ? mercadoPagoAccount.provider_currency as Currency
    : APPLICATION_CURRENCY;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const platformPayouts = paymentProvider === "paypal" && serverEnv.PAYPAL_FLOW === "platform_payouts";
  const paymentAccountRequest = paymentProvider === "paypal"
    ? platformPayouts
      ? supabase.from("payout_accounts").select("status,provider_account_id,bank_name").eq("creator_id", user.id).eq("provider", "paypal").maybeSingle()
      : supabase.from("payment_accounts").select("status,payments_receivable,email_confirmed,onboarding_completed").eq("creator_id", user.id).eq("provider", "paypal").maybeSingle()
    : Promise.resolve({ data: mercadoPagoAccount });
  const tipTotalsRequest = paymentProvider === "paypal" || paymentProvider === "mercadopago"
    ? supabase.rpc("creator_tip_totals", { requested_creator: user.id })
    : Promise.resolve({ data: null });
  const latestTipsBase = supabase.from("tips").select("id,payer_name,message,anonymous,base_amount_minor,amount_minor,net_amount_minor,currency,status,created_at").eq("creator_id", user.id).order("created_at", { ascending: false });
  const latestTipsRequest = paymentProvider === "paypal" || paymentProvider === "mercadopago"
    ? latestTipsBase.eq("status", "confirmed").limit(6)
    : latestTipsBase.limit(6);
  const [{ data: profile }, { data: balances }, { data: tips }, { data: todayTips }, { data: paymentAccount }, { data: tipTotals }] = await Promise.all([
    supabase.from("profiles").select("public_name,username,avatar_url").eq("id", user.id).single(),
    supabase.rpc("creator_balances", { requested_creator: user.id }),
    latestTipsRequest,
    supabase.from("tips").select("base_amount_minor,amount_minor,net_amount_minor,currency,status,created_at,confirmed_at").eq("creator_id", user.id).eq("status", "confirmed").gte("confirmed_at", monthStart.toISOString()),
    paymentAccountRequest,
    tipTotalsRequest,
  ]);
  const balance = (balances as Array<{ currency: Currency; available_minor: number; pending_minor: number }> | null)?.find((item) => item.currency === currency);
  const totals = (tipTotals as Array<{ currency: Currency; gross_confirmed_minor: number; platform_fees_minor: number; gateway_fees_minor: number; net_confirmed_minor: number }> | null)?.find((item) => item.currency === currency);
  const confirmedMonth = (todayTips ?? []).filter((tip) => tip.status === "confirmed" && tip.currency === currency);
  const confirmedToday = confirmedMonth.filter((tip) => new Date(tip.confirmed_at ?? tip.created_at) >= todayStart);
  const todayNetMinor = confirmedToday.reduce((sum, tip) => sum + Number(tip.net_amount_minor ?? tip.amount_minor), 0);
  const monthNetMinor = confirmedMonth.reduce((sum, tip) => sum + Number(tip.net_amount_minor ?? tip.amount_minor), 0);
  const todayGrossMinor = confirmedToday.reduce((sum, tip) => sum + creatorVisibleTipAmount(tip), 0);
  const monthGrossMinor = confirmedMonth.reduce((sum, tip) => sum + creatorVisibleTipAmount(tip), 0);
  const publicUrl = profile?.username ? buildPublicProfileUrl(getPublicEnv().NEXT_PUBLIC_APP_URL, profile.username) : null;
  const mercadoPagoConnected = paymentProvider === "mercadopago" && mercadoPagoAccount?.status === "connected" && mercadoPagoAccount.onboarding_completed === true && mercadoPagoAccount.payments_receivable === true;
  const paypalAccountState = paymentAccount as {
    status?: string;
    payments_receivable?: boolean;
    email_confirmed?: boolean;
    onboarding_completed?: boolean;
    provider_account_id?: string;
  } | null;
  const paypalConnected = paymentProvider === "paypal" && (
    platformPayouts
      ? (paypalAccountState?.status === "pending" || paypalAccountState?.status === "verified")
      : paypalAccountState?.status === "connected" && paypalAccountState.payments_receivable === true && paypalAccountState.onboarding_completed === true
  );
  const paypalVerified = paypalConnected;
  const availableMinor = (paymentProvider === "paypal" && !platformPayouts) || paymentProvider === "mercadopago" ? Number(totals?.net_confirmed_minor ?? 0) : Number(balance?.available_minor ?? 0);
  const feesMinor = Number(totals?.platform_fees_minor ?? 0) + Number(totals?.gateway_fees_minor ?? 0);

  return <><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><DashboardProfileHeader name={profile?.public_name ?? "Tu cuenta"} avatarUrl={profile?.avatar_url ?? null} />{paypalConnected && <PayPalConnectionBadge verified={paypalVerified} />}{mercadoPagoConnected && <MercadoPagoConnectionBadge currency={currency} />}</div>{serverEnv.PAYMENT_PROVIDER === "whop" && <WhopActivationCard connected={whopConnected} />}{paymentProvider === "paypal" && !paypalConnected && <PayPalActivationCard connected={paypalConnected} verified={paypalVerified} />}<BalanceSummary currency={currency} availableMinor={availableMinor} pendingMinor={Number(balance?.pending_minor ?? 0)} todayMinor={paymentProvider === "paypal" || paymentProvider === "mercadopago" ? todayGrossMinor : todayNetMinor} monthMinor={paymentProvider === "paypal" || paymentProvider === "mercadopago" ? monthGrossMinor : monthNetMinor} grossConfirmedMinor={Number(totals?.gross_confirmed_minor ?? 0)} feesMinor={feesMinor} paymentProvider={paymentProvider} platformPayouts={platformPayouts} sandboxSingleMerchant={serverEnv.PAYPAL_SANDBOX_SINGLE_MERCHANT} shareActions={publicUrl && profile?.username ? <CreatorShareCard publicUrl={publicUrl} username={profile.username} /> : undefined} refreshAction={<BalanceRefreshButton />} /><div className="mt-6"><RecentTips tips={(tips ?? []) as RecentTip[]} showAllLink twoColumns /></div></>;
}
