"use client";

import { useMemo, useState } from "react";
import { Heart, LockSimple, SpinnerGap } from "@phosphor-icons/react";
import { getDictionary } from "@/lib/i18n";
import type { Currency } from "@/features/payments/types";
import type { Locale } from "@/lib/i18n/config";
import type { CheckoutPresentation } from "@/features/payments/provider";
import { PayPalCheckout } from "@/components/payments/paypal-checkout";
import { CURRENT_LEGAL_TERMS_VERSION } from "@/features/legal/terms";

function currencyDigits(currency: Currency) { return new Intl.NumberFormat("es", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2; }
function decimalToMinor(value: string, digits: number): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > digits) return null;
  const result = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0") || 0);
  return Number.isSafeInteger(result) ? result : null;
}

type Embedded = Extract<CheckoutPresentation, { kind: "embedded" }>;
type ActiveCheckout = { tipId: string; orderId: string; receiptToken: string; checkout: Embedded };

export function TipForm({ username, currency, locale }: { username: string; currency: Currency; locale: Locale }) {
  const t = getDictionary(locale); const digits = currencyDigits(currency); const unit = 10 ** digits;
  const presets = useMemo(() => [5, 10, 20, 50].map((amount) => amount * unit), [unit]);
  const [amountMinor, setAmountMinor] = useState(20 * unit); const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false); const [anonymous, setAnonymous] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false); const [error, setError] = useState<string | null>(null);
  const [activeCheckout, setActiveCheckout] = useState<ActiveCheckout | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const finalAmount = showCustom ? decimalToMinor(custom, digits) : amountMinor;
    if (!finalAmount || finalAmount < unit) { setError(locale === "es" ? "Ingresa un monto válido." : "Enter a valid amount."); return; }
    setSubmitting(true); setError(null);
    try {
      const response = await fetch("/api/tips", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        username, amountMinor: finalAmount, payerName: anonymous ? null : String(form.get("payerName") || ""),
        message: String(form.get("message") || ""), anonymous, legalAccepted,
        legalTermsVersion: CURRENT_LEGAL_TERMS_VERSION,
      }) });
      const data = await response.json() as { tipId: string; providerPaymentId: string; receiptToken: string; checkout: CheckoutPresentation; error?: string };
      if (!response.ok) throw new Error(data.error);
      if (data.checkout.kind === "redirect") { window.location.assign(data.checkout.url); return; }
      setActiveCheckout({ tipId: data.tipId, orderId: data.providerPaymentId, receiptToken: data.receiptToken, checkout: data.checkout });
    } catch { setError(locale === "es" ? "No pudimos iniciar el tip. Comprueba tu conexión." : "We could not start the tip. Check your connection."); setSubmitting(false); }
  }

  return <><form onSubmit={submit} className="mt-8"><fieldset disabled={submitting}><legend className="text-lg font-semibold">{t.tip.heading}</legend><p className="mt-2 text-sm leading-relaxed text-muted">{t.tip.currencyNotice}</p><div className="mt-4 grid grid-cols-4 gap-2">{presets.map((amount) => <button key={amount} type="button" onClick={() => { setAmountMinor(amount); setShowCustom(false); }} className={`pressable min-h-12 rounded-xl border px-2 font-bold ${!showCustom && amountMinor === amount ? "border-accent bg-accent text-on-accent" : "border-border bg-background hover:border-accent"}`}>{amount / unit}</button>)}</div><button type="button" onClick={() => setShowCustom(true)} className={`pressable mt-2 min-h-12 w-full rounded-xl border font-semibold ${showCustom ? "border-accent text-accent" : "border-border"}`}>{t.tip.otherAmount}</button>{showCustom && <label className="mt-3 block text-sm font-semibold">{locale === "es" ? "Monto en" : "Amount in"} {currency}<input autoFocus inputMode="decimal" value={custom} onChange={(event) => setCustom(event.target.value)} placeholder={digits ? "20.00" : "20000"} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-lg outline-none focus:border-accent" /></label>}
    <div className="mt-6 space-y-4">{!anonymous && <label className="block text-sm font-semibold">{t.tip.name}<input name="payerName" maxLength={60} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent" /></label>}<label className="block text-sm font-semibold">{t.tip.message}<textarea name="message" maxLength={280} className="mt-2 min-h-24 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-accent" placeholder={locale === "es" ? "Para ti ❤️" : "For you ❤️"} /></label><label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-surface-soft px-4"><input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} className="size-5 accent-accent" /><LockSimple size={20} className="text-muted" /><span className="text-sm font-semibold">{t.tip.anonymous}</span></label></div>
    <div className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-surface-soft p-4"><input id="legalAccepted" name="legalAccepted" type="checkbox" required checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-accent" /><label htmlFor="legalAccepted" className="text-xs leading-relaxed text-muted">{locale === "es" ? <>Confirmo que este tip es un apoyo voluntario y no compra contenido ni servicios. Acepto los <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-foreground underline">Términos</a> y la <a href="/refund-policy" target="_blank" rel="noreferrer" className="font-semibold text-foreground underline">Política de reembolsos</a>.</> : <>I confirm this tip is voluntary support and does not purchase content or services. I accept the <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-foreground underline">Terms</a> and <a href="/refund-policy" target="_blank" rel="noreferrer" className="font-semibold text-foreground underline">Refund Policy</a>.</>}</label></div>
    {error && <p role="alert" className="mt-4 text-sm font-semibold text-accent-strong">{error}</p>}<button className="pressable mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 font-bold text-on-accent hover:bg-accent-strong">{submitting ? <><SpinnerGap size={22} className="animate-spin" /> {locale === "es" ? "Preparando pago" : "Preparing payment"}</> : <><Heart size={21} weight="fill" /> {t.tip.send}</>}</button><p className="mt-3 text-center text-xs leading-relaxed text-muted">{locale === "es" ? "El saldo solo cambia cuando el pago es confirmado por el servidor." : "The balance only changes after server confirmation."}</p></fieldset></form>
    {activeCheckout && <PayPalCheckout tipId={activeCheckout.tipId} orderId={activeCheckout.orderId} receiptToken={activeCheckout.receiptToken} checkout={activeCheckout.checkout} locale={locale} />}</>;
}
