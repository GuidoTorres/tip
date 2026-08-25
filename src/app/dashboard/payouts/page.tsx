import { Bank, CheckCircle, Clock, PaypalLogo, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/i18n";
import { supportedCurrencies, type Currency } from "@/features/payments/types";
import { APPLICATION_CURRENCY } from "@/features/payments/application-currency";
import { sumWithdrawnByCurrency } from "@/features/ledger/money";
import { PayoutForm } from "@/components/payouts/payout-form";
import { MockPayoutActions } from "@/components/payouts/mock-payout-actions";
import { mockSimulatorAllowed } from "@/lib/env/runtime";
import { getServerEnv } from "@/lib/env/server";
import { PayPalFundsPanel } from "@/components/payouts/paypal-funds-panel";
import { PayPalPayoutEmailForm } from "@/components/payouts/paypal-payout-email-form";
import { MercadoPagoConnectionBadge } from "@/components/dashboard/mercadopago-connection-badge";
import Link from "next/link";

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const serverEnv = getServerEnv();
  if (serverEnv.PAYMENT_PROVIDER === "mercadopago") {
    const [{ data: paymentAccount }, { data: totals }] = await Promise.all([
      supabase.from("payment_accounts").select("status,provider_country,provider_currency,onboarding_completed").eq("creator_id", user.id).eq("provider", "mercadopago").maybeSingle(),
      supabase.rpc("creator_tip_totals", { requested_creator: user.id }),
    ]);
    const currency: Currency = paymentAccount?.provider_currency && supportedCurrencies.includes(paymentAccount.provider_currency as Currency)
      ? paymentAccount.provider_currency as Currency
      : APPLICATION_CURRENCY;
    const total = (totals as Array<{ currency: Currency; net_confirmed_minor: number }> | null)?.find((item) => item.currency === currency);
    const connected = paymentAccount?.status === "connected" && paymentAccount.onboarding_completed === true;
    return <div className="mx-auto max-w-2xl"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-semibold tracking-[-0.04em]">Tu dinero</h1><p className="mt-2 text-muted">Mercado Pago administra el saldo y los retiros de tu cuenta.</p></div>{connected && <MercadoPagoConnectionBadge currency={currency} />}</div><section className="mt-7 rounded-2xl border border-border bg-surface p-6"><p className="text-sm text-muted">Total neto confirmado por TipMe</p><p className="mt-2 text-5xl font-semibold tracking-[-0.06em]">{formatMoney(Number(total?.net_confirmed_minor ?? 0), currency, "es")}</p><p className="mt-5 rounded-xl bg-surface-soft p-4 text-sm leading-relaxed text-muted">El fan paga directamente a tu cuenta. Consulta el saldo disponible, plazos y retiros desde Mercado Pago; TipMe no retiene ni transfiere estos fondos.</p>{!connected && <Link href="/onboarding?step=2" className="pressable mt-5 inline-flex min-h-12 items-center rounded-full bg-accent px-5 font-bold text-on-accent">Conectar Mercado Pago</Link>}</section></div>;
  }
  const platformPayouts = serverEnv.PAYMENT_PROVIDER === "paypal" && serverEnv.PAYPAL_FLOW === "platform_payouts";
  if (serverEnv.PAYMENT_PROVIDER === "paypal" && !platformPayouts) {
    const [{ data: balances }, { data: paymentAccount }] = await Promise.all([
      supabase.rpc("creator_balances", { requested_creator: user.id }),
      supabase.from("payment_accounts").select("status,payments_receivable,email_confirmed,onboarding_completed").eq("creator_id", user.id).eq("provider", "paypal").maybeSingle(),
    ]);
    const currency: Currency = APPLICATION_CURRENCY;
    const balance = (balances as Array<{ currency: Currency; available_minor: number; pending_minor: number }> | null)?.find((item) => item.currency === currency);
    const connected = serverEnv.PAYPAL_SANDBOX_SINGLE_MERCHANT || (paymentAccount?.status === "connected" && paymentAccount.payments_receivable && paymentAccount.email_confirmed && paymentAccount.onboarding_completed);
    return <div className="mx-auto max-w-2xl"><h1 className="text-3xl font-semibold tracking-[-0.04em]">Tu dinero</h1><p className="mt-2 text-muted">{serverEnv.PAYPAL_SANDBOX_SINGLE_MERCHANT ? "Vista de prueba basada en pagos confirmados por PayPal Sandbox." : "Los pagos se envían directamente a la cuenta PayPal conectada."}</p><PayPalFundsPanel netConfirmedMinor={Number(balance?.available_minor ?? 0)} pendingMinor={Number(balance?.pending_minor ?? 0)} currency={currency} connected={Boolean(connected)} sandboxSingleMerchant={serverEnv.PAYPAL_SANDBOX_SINGLE_MERCHANT} /></div>;
  }
  const accountRequest = supabase.from("payout_accounts").select("id,provider,provider_account_id,bank_name,last4,status").eq("creator_id", user.id).eq("provider", platformPayouts ? "paypal" : "mock").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const [{ data: balances }, { data: account }, { data: payouts }, { data: payoutMovements }] = await Promise.all([
    supabase.rpc("creator_balances", { requested_creator: user.id }),
    accountRequest,
    supabase.from("payouts").select("id,amount_minor,recipient_amount_minor,estimated_fee_minor,gateway_fee_minor,currency,status,provider_payout_id,created_at").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("ledger_entries").select("amount_minor,currency").eq("creator_id", user.id).eq("type", "payout"),
  ]);
  const currency: Currency = APPLICATION_CURRENCY;
  const balance = (balances as Array<{ currency: Currency; available_minor: number }> | null)?.find((item) => item.currency === currency);
  const available = Number(balance?.available_minor ?? 0);
  const digits = new Intl.NumberFormat("es", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const withdrawnTotals = sumWithdrawnByCurrency((payoutMovements ?? []).map((entry) => ({
    amountMinor: Number(entry.amount_minor),
    currency: entry.currency as Currency,
  })));
  const withdrawnCurrencies = [
    currency,
    ...supportedCurrencies.filter((item) => item !== currency && (withdrawnTotals[item] ?? 0) > 0),
  ];
  const accountReady = account && (account.status === "verified" || (platformPayouts && account.status === "pending"));
  return <div className="mx-auto max-w-2xl"><h1 className="text-3xl font-semibold tracking-[-0.04em]">Retiros</h1><section className="mt-7 rounded-2xl border border-border bg-surface p-6"><p className="text-sm text-muted">Disponible</p><p className="mt-2 text-5xl font-semibold tracking-[-0.06em]">{formatMoney(available, currency, "es")}</p><div className="mt-6 border-t border-border pt-5"><p className="text-sm text-muted">Total retirado</p><div className="mt-2 flex flex-wrap gap-2">{withdrawnCurrencies.map((withdrawnCurrency) => <span key={withdrawnCurrency} className="rounded-full bg-surface-soft px-3 py-2 text-sm font-semibold">{formatMoney(withdrawnTotals[withdrawnCurrency] ?? 0, withdrawnCurrency, "es")}</span>)}</div></div>{query.error && <p role="alert" className="mt-5 rounded-xl bg-surface-soft p-3 text-sm font-semibold text-accent-strong">{query.error === "insufficient_balance" ? "No tienes saldo suficiente." : "No pudimos solicitar el retiro."}</p>}{query.success && <p className="mt-5 rounded-xl bg-surface-soft p-3 text-sm font-semibold text-success">{query.success === "paypal_saved" ? "Correo PayPal guardado." : "Retiro solicitado."}</p>}{accountReady ? <PayoutForm accountId={account.id} currency={currency} availableMinor={available} fractionDigits={digits} payoutFeeBps={platformPayouts ? serverEnv.PAYPAL_PAYOUT_FEE_BPS : 0} payoutFeeCapMinor={platformPayouts ? serverEnv.PAYPAL_PAYOUT_FEE_CAP_MINOR : 0} /> : <p className="mt-6 rounded-xl bg-surface-soft p-4 text-sm text-warning">Configura tu método de retiro antes de continuar.</p>}</section>{account && <section className="mt-4 rounded-2xl border border-border bg-surface p-5"><div className="flex items-center gap-4">{platformPayouts ? <PaypalLogo size={28} className="text-[#0070e0]" weight="fill" /> : <Bank size={28} className="text-accent" weight="fill" />}<div className="min-w-0"><p className="font-semibold">{platformPayouts ? "PayPal" : account.bank_name ?? "Banco"}</p><p className="truncate text-sm text-muted">{platformPayouts ? account.provider_account_id : `•••• ${account.last4 ?? "0000"}`}</p></div><span className={`ml-auto text-sm font-semibold ${account.status === "verified" ? "text-success" : "text-warning"}`}>{account.status === "verified" ? "Verificado" : "Pendiente"}</span></div>{platformPayouts && <details className="mt-4 border-t border-border pt-4"><summary className="pressable cursor-pointer text-sm font-semibold text-muted">Cambiar correo PayPal</summary><div className="mt-4"><PayPalPayoutEmailForm email={account.provider_account_id} status={account.status === "verified" ? "verified" : "pending"} returnTo="/dashboard/payouts" /></div></details>}</section>}<section className="mt-8"><h2 className="text-xl font-semibold">Historial</h2><div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">{!payouts?.length ? <p className="p-6 text-center text-sm text-muted">Todavía no tienes retiros.</p> : payouts.map((payout, index) => <div key={payout.id} className={`flex flex-wrap items-center gap-3 p-4 ${index ? "border-t border-border" : ""}`}>{payout.status === "completed" ? <CheckCircle className="text-success" weight="fill" /> : payout.status === "failed" ? <WarningCircle className="text-accent" weight="fill" /> : <Clock className="text-warning" weight="fill" />}<div><p className="font-semibold">{payout.status === "completed" ? "Completado" : payout.status === "failed" ? "Fallido" : payout.status === "processing" ? "Procesando" : "Solicitado"}</p><p className="text-xs text-muted">{new Date(payout.created_at).toLocaleDateString("es")}</p></div><p className="ml-auto font-bold">{formatMoney(Number(payout.recipient_amount_minor ?? payout.amount_minor), payout.currency as Currency, "es")}</p>{platformPayouts && <p className="w-full pl-9 text-xs text-muted">Comisión de envío: {formatMoney(Number(payout.gateway_fee_minor ?? payout.estimated_fee_minor ?? 0), payout.currency as Currency, "es")}{payout.gateway_fee_minor == null ? " estimada" : ""}</p>}{mockSimulatorAllowed(process.env) && payout.provider_payout_id && !["completed", "failed"].includes(payout.status) && <div className="w-full"><MockPayoutActions payoutId={payout.id} status={payout.status} /></div>}</div>)}</div></section>{platformPayouts && !account && <section className="mt-4 rounded-2xl border border-border bg-surface p-5"><PayPalPayoutEmailForm returnTo="/dashboard/payouts" /></section>}</div>;
}
