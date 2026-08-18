import { Bank, CheckCircle, Clock, WarningCircle } from "@phosphor-icons/react/dist/ssr";
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

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const serverEnv = getServerEnv();
  if (serverEnv.PAYMENT_PROVIDER === "paypal") {
    const [{ data: balances }, { data: paymentAccount }] = await Promise.all([
      supabase.rpc("creator_balances", { requested_creator: user.id }),
      supabase.from("payment_accounts").select("status,payments_receivable,email_confirmed,onboarding_completed").eq("creator_id", user.id).eq("provider", "paypal").maybeSingle(),
    ]);
    const currency: Currency = APPLICATION_CURRENCY;
    const balance = (balances as Array<{ currency: Currency; available_minor: number; pending_minor: number }> | null)?.find((item) => item.currency === currency);
    const connected = serverEnv.PAYPAL_SANDBOX_SINGLE_MERCHANT || (paymentAccount?.status === "connected" && paymentAccount.payments_receivable && paymentAccount.email_confirmed && paymentAccount.onboarding_completed);
    return <div className="mx-auto max-w-2xl"><h1 className="text-3xl font-semibold tracking-[-0.04em]">Tu dinero</h1><p className="mt-2 text-muted">{serverEnv.PAYPAL_SANDBOX_SINGLE_MERCHANT ? "Vista de prueba basada en pagos confirmados por PayPal Sandbox." : "Los pagos se envían directamente a la cuenta PayPal conectada."}</p><PayPalFundsPanel netConfirmedMinor={Number(balance?.available_minor ?? 0)} pendingMinor={Number(balance?.pending_minor ?? 0)} currency={currency} connected={Boolean(connected)} sandboxSingleMerchant={serverEnv.PAYPAL_SANDBOX_SINGLE_MERCHANT} /></div>;
  }
  const [{ data: balances }, { data: account }, { data: payouts }, { data: payoutMovements }] = await Promise.all([
    supabase.rpc("creator_balances", { requested_creator: user.id }),
    supabase.from("payout_accounts").select("id,bank_name,last4,status").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("payouts").select("id,amount_minor,currency,status,provider_payout_id,created_at").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(20),
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
  return <div className="mx-auto max-w-2xl"><h1 className="text-3xl font-semibold tracking-[-0.04em]">Retiros</h1><section className="mt-7 rounded-2xl border border-border bg-surface p-6"><p className="text-sm text-muted">Disponible</p><p className="mt-2 text-5xl font-semibold tracking-[-0.06em]">{formatMoney(available, currency, "es")}</p><div className="mt-6 border-t border-border pt-5"><p className="text-sm text-muted">Total retirado</p><div className="mt-2 flex flex-wrap gap-2">{withdrawnCurrencies.map((withdrawnCurrency) => <span key={withdrawnCurrency} className="rounded-full bg-surface-soft px-3 py-2 text-sm font-semibold">{formatMoney(withdrawnTotals[withdrawnCurrency] ?? 0, withdrawnCurrency, "es")}</span>)}</div></div>{query.error && <p role="alert" className="mt-5 rounded-xl bg-surface-soft p-3 text-sm font-semibold text-accent-strong">{query.error === "insufficient_balance" ? "No tienes saldo suficiente." : "No pudimos solicitar el retiro."}</p>}{query.success && <p className="mt-5 rounded-xl bg-surface-soft p-3 text-sm font-semibold text-success">Retiro solicitado.</p>}{account?.status === "verified" ? <PayoutForm accountId={account.id} currency={currency} availableMinor={available} fractionDigits={digits} /> : <p className="mt-6 rounded-xl bg-surface-soft p-4 text-sm text-warning">Configura y verifica tu método de retiro antes de continuar.</p>}</section>{account && <section className="mt-4 flex items-center gap-4 rounded-2xl border border-border bg-surface p-5"><Bank size={28} className="text-accent" weight="fill" /><div><p className="font-semibold">{account.bank_name ?? "Banco"}</p><p className="text-sm text-muted">•••• {account.last4 ?? "0000"}</p></div><span className="ml-auto text-sm font-semibold text-success">Verificado</span></section>}<section className="mt-8"><h2 className="text-xl font-semibold">Historial</h2><div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">{!payouts?.length ? <p className="p-6 text-center text-sm text-muted">Todavía no tienes retiros.</p> : payouts.map((payout, index) => <div key={payout.id} className={`flex flex-wrap items-center gap-3 p-4 ${index ? "border-t border-border" : ""}`}>{payout.status === "completed" ? <CheckCircle className="text-success" weight="fill" /> : payout.status === "failed" ? <WarningCircle className="text-accent" weight="fill" /> : <Clock className="text-warning" weight="fill" />}<div><p className="font-semibold">{payout.status === "completed" ? "Completado" : payout.status === "failed" ? "Fallido" : payout.status === "processing" ? "Procesando" : "Solicitado"}</p><p className="text-xs text-muted">{new Date(payout.created_at).toLocaleDateString("es")}</p></div><p className="ml-auto font-bold">{formatMoney(Number(payout.amount_minor), payout.currency as Currency, "es")}</p>{mockSimulatorAllowed(process.env) && payout.provider_payout_id && !["completed", "failed"].includes(payout.status) && <div className="w-full"><MockPayoutActions payoutId={payout.id} status={payout.status} /></div>}</div>)}</div></section></div>;
}
