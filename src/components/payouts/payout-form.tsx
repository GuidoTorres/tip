"use client";

import { useState } from "react";
import { HandCoins } from "@phosphor-icons/react";
import { requestPayoutAction } from "@/features/payouts/actions";
import type { Currency } from "@/features/payments/types";
import { quotePayoutFromDebit } from "@/features/ledger/money";

export function PayoutForm({ accountId, currency, availableMinor, fractionDigits, payoutFeeBps = 0, payoutFeeCapMinor = 0 }: { accountId: string; currency: Currency; availableMinor: number; fractionDigits: number; payoutFeeBps?: number; payoutFeeCapMinor?: number }) {
  const [value, setValue] = useState("");
  const unit = 10 ** fractionDigits;
  const amountMinor = Math.round(Number(value.replace(",", ".")) * unit);
  const invalid = !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > availableMinor;
  let quote: ReturnType<typeof quotePayoutFromDebit> | null = null;
  if (!invalid) {
    try { quote = quotePayoutFromDebit(amountMinor, payoutFeeBps, payoutFeeCapMinor); } catch { quote = null; }
  }
  const money = new Intl.NumberFormat("es-PE", { style: "currency", currency });
  return <form action={requestPayoutAction} className="mt-6"><input type="hidden" name="accountId" value={accountId} /><input type="hidden" name="currency" value={currency} /><input type="hidden" name="amountMinor" value={Number.isFinite(amountMinor) ? amountMinor : 0} /><label className="text-sm font-semibold">Monto total a descontar en {currency}<input value={value} onChange={(event) => setValue(event.target.value)} inputMode="decimal" placeholder={fractionDigits ? "100.00" : "100000"} className="mt-2 min-h-14 w-full rounded-xl border border-border bg-background px-4 text-xl outline-none focus:border-accent" /></label>{amountMinor > availableMinor && <p className="mt-2 text-sm font-semibold text-accent-strong">No puedes retirar más del saldo disponible.</p>}{quote && payoutFeeBps > 0 && <div className="mt-4 rounded-xl bg-surface-soft p-4 text-sm"><div className="flex justify-between gap-4"><span className="text-muted">Recibirás aproximadamente</span><strong>{money.format(quote.recipientAmountMinor / unit)}</strong></div><div className="mt-2 flex justify-between gap-4"><span className="text-muted">Comisión PayPal reservada</span><span>{money.format(quote.estimatedFeeMinor / unit)}</span></div><p className="mt-2 text-xs text-muted">El saldo se ajustará con la comisión real informada por PayPal.</p></div>}<button disabled={invalid} className="pressable mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 font-bold text-on-accent disabled:cursor-not-allowed disabled:opacity-50"><HandCoins size={22} weight="fill" /> RETIRAR AHORA</button></form>;
}
