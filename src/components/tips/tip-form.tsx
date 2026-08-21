"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, SpinnerGap } from "@phosphor-icons/react";
import { PayPalCheckout } from "@/components/payments/paypal-checkout";
import type { CreatedCheckoutAttempt } from "@/features/payments/checkout-attempt";
import { calculateProcessingSupportMinor } from "@/features/ledger/money";
import { CURRENT_LEGAL_TERMS_VERSION } from "@/features/legal/terms";
import type { CheckoutBootstrap } from "@/features/payments/prepare-checkout";
import type { CheckoutPresentation } from "@/features/payments/provider";
import type { MercadoPagoCardPaymentData } from "@/features/payments/provider";
import { MercadoPagoCardCheckout } from "@/components/payments/mercadopago-card-checkout";
import type { Currency } from "@/features/payments/types";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

function currencyDigits(currency: Currency) {
  return new Intl.NumberFormat("es", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

function decimalToMinor(value: string, digits: number): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > digits) return null;
  const result = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0") || 0);
  return Number.isSafeInteger(result) ? result : null;
}

type TipPayload = {
  username: string;
  amountMinor: number;
  payerName: string | null;
  message: string;
  anonymous: boolean;
  legalAccepted: boolean;
  coverProcessing: boolean;
  legalTermsVersion: string;
  quoteToken?: string;
};

type MercadoPagoQuote = {
  amountUsdMinor: number;
  localAmountMinor: number;
  currency: Currency;
  rate: number;
  quotedAt: string;
  quoteToken: string;
};

type CreatedTip = {
  tipId: string;
  providerPaymentId: string;
  receiptToken: string;
  checkout?: CheckoutPresentation;
  error?: string;
};

export function TipForm({ username, currency, locale, checkoutFeeBps = 0, checkoutFixedFeeMinor = 0, allowProcessingSupport = true }: {
  username: string;
  currency: Currency;
  locale: Locale;
  checkoutFeeBps?: number;
  checkoutFixedFeeMinor?: number;
  allowProcessingSupport?: boolean;
}) {
  const t = getDictionary(locale);
  const digits = currencyDigits(currency);
  const unit = 10 ** digits;
  const presets = useMemo(() => [5, 10, 20, 50].map((amount) => amount * unit), [unit]);
  const formRef = useRef<HTMLFormElement>(null);
  const embeddedPayload = useRef<TipPayload | null>(null);
  const [amountMinor, setAmountMinor] = useState(20 * unit);
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [coverProcessing, setCoverProcessing] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutLocked, setCheckoutLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<CheckoutBootstrap | null>(null);
  const [bootstrapError, setBootstrapError] = useState(false);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [quote, setQuote] = useState<MercadoPagoQuote | null>(null);
  const [quoteError, setQuoteError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/payments/checkout-config?username=${encodeURIComponent(username)}`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json().catch(() => null) as CheckoutBootstrap | null;
      if (!response.ok || !data || !["embedded", "redirect", "mercadopago"].includes(data.kind)) throw new Error("checkout_unavailable");
      if (data.kind === "embedded" && data.checkout.kind !== "embedded") throw new Error("checkout_unavailable");
      setBootstrap(data);
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setBootstrapError(true);
    });
    return () => controller.abort();
  }, [bootstrapAttempt, username]);

  const selectedAmount = showCustom ? decimalToMinor(custom, digits) : amountMinor;
  const supportMinor = coverProcessing && selectedAmount && selectedAmount > 0
    ? calculateProcessingSupportMinor(selectedAmount, checkoutFeeBps, checkoutFixedFeeMinor)
    : 0;
  const estimatedTotalMinor = (selectedAmount ?? 0) + supportMinor;
  const money = new Intl.NumberFormat(locale === "es" ? "es-PE" : "en-US", { style: "currency", currency });

  useEffect(() => {
    if (bootstrap?.kind !== "mercadopago" || !selectedAmount || selectedAmount < 100) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setQuote(null);
      setQuoteError(false);
      fetch("/api/payments/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, amountUsdMinor: selectedAmount }),
        cache: "no-store",
        signal: controller.signal,
      }).then(async (response) => {
        const data = await response.json().catch(() => null) as MercadoPagoQuote | null;
        if (!response.ok || !data?.quoteToken || data.amountUsdMinor !== selectedAmount) throw new Error("quote_unavailable");
        setQuote(data);
      }).catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setQuoteError(true);
      });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [bootstrap, selectedAmount, username]);

  function buildPayload(): TipPayload {
    const form = formRef.current;
    if (!form || !form.reportValidity()) throw new Error("invalid_tip_form");
    const finalAmount = showCustom ? decimalToMinor(custom, digits) : amountMinor;
    if (!finalAmount || finalAmount < unit) {
      setError(locale === "es" ? "Ingresa un monto válido." : "Enter a valid amount.");
      throw new Error("invalid_tip_amount");
    }
    const formData = new FormData(form);
    const payerName = String(formData.get("payerName") ?? "").trim();
    return {
      username,
      amountMinor: finalAmount,
      payerName: payerName || null,
      message: String(formData.get("message") ?? ""),
      anonymous: payerName === "",
      legalAccepted,
      coverProcessing,
      legalTermsVersion: CURRENT_LEGAL_TERMS_VERSION,
    };
  }

  async function createTipRequest(payload: TipPayload) {
    const response = await fetch("/api/tips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({})) as CreatedTip;
    if (!response.ok || !data.tipId || !data.providerPaymentId || !data.receiptToken) throw new Error(data.error || "tip_create_failed");
    return data;
  }

  async function createEmbeddedOrder(): Promise<CreatedCheckoutAttempt> {
    setError(null);
    try {
      const payload = embeddedPayload.current ?? buildPayload();
      embeddedPayload.current = payload;
      setCheckoutLocked(true);
      const data = await createTipRequest(payload);
      return { tipId: data.tipId, orderId: data.providerPaymentId, receiptToken: data.receiptToken };
    } catch (reason) {
      embeddedPayload.current = null;
      setCheckoutLocked(false);
      if (reason instanceof Error && !reason.message.startsWith("invalid_tip_")) {
        setError(locale === "es" ? "No pudimos iniciar el tip. Comprueba tu conexión." : "We could not start the tip. Check your connection.");
      }
      throw reason;
    }
  }

  async function submitRedirect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bootstrap?.kind !== "redirect") return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await createTipRequest(buildPayload());
      if (data.checkout?.kind !== "redirect") throw new Error("redirect_unavailable");
      window.location.assign(data.checkout.url);
    } catch {
      setError(locale === "es" ? "No pudimos iniciar el tip. Comprueba tu conexión." : "We could not start the tip. Check your connection.");
      setSubmitting(false);
    }
  }

  async function submitMercadoPago(paymentMethodData: MercadoPagoCardPaymentData) {
    if (bootstrap?.kind !== "mercadopago" || !quote) throw new Error("checkout_unavailable");
    setSubmitting(true);
    setError(null);
    try {
      const data = await createTipRequest({ ...buildPayload(), quoteToken: quote.quoteToken, paymentMethodData } as TipPayload & { paymentMethodData: MercadoPagoCardPaymentData });
      return { tipId: data.tipId, receiptToken: data.receiptToken };
    } catch (reason) {
      setSubmitting(false);
      setError(locale === "es" ? "No pudimos iniciar el tip. Revisa los datos del pago." : "We could not start the tip. Check the payment details.");
      throw reason;
    }
  }

  return <div className="mt-8"><form ref={formRef} onSubmit={submitRedirect}>
    <fieldset disabled={submitting || checkoutLocked}>
      <legend className="text-lg font-semibold">{t.tip.heading}</legend>
      <p className="mt-2 text-sm leading-relaxed text-muted">{t.tip.currencyNotice}</p>
      <div className="mt-4 grid grid-cols-4 gap-2">{presets.map((amount) => <button key={amount} type="button" onClick={() => { setAmountMinor(amount); setShowCustom(false); }} className={`pressable min-h-12 rounded-xl border px-2 font-bold ${!showCustom && amountMinor === amount ? "border-accent bg-accent text-on-accent" : "border-border bg-background hover:border-accent"}`}>{amount / unit}</button>)}</div>
      <button type="button" onClick={() => setShowCustom(true)} className={`pressable mt-2 min-h-12 w-full rounded-xl border font-semibold ${showCustom ? "border-accent text-accent" : "border-border"}`}>{t.tip.otherAmount}</button>
      {showCustom && <label className="mt-3 block text-sm font-semibold">{locale === "es" ? "Monto en" : "Amount in"} {currency}<input autoFocus inputMode="decimal" value={custom} onChange={(event) => setCustom(event.target.value)} placeholder={digits ? "20.00" : "20000"} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-lg outline-none focus:border-accent" /></label>}
      <div className="mt-6 space-y-4">
        <label className="block text-sm font-semibold">{t.tip.name}<input name="payerName" maxLength={60} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent" /></label>
        <label className="block text-sm font-semibold">{t.tip.message}<textarea name="message" rows={2} maxLength={280} className="mt-2 min-h-16 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-accent" placeholder={locale === "es" ? "Para ti ❤️" : "For you ❤️"} /></label>
        {allowProcessingSupport && <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3"><input type="checkbox" checked={coverProcessing} onChange={(event) => setCoverProcessing(event.target.checked)} className="size-5 shrink-0 accent-accent" /><span className="text-sm font-semibold">{locale === "es" ? "Ayudar con la comisión de pago" : "Help with the payment fee"}</span></label>}
        {coverProcessing && estimatedTotalMinor > 0 && <p className="text-right text-sm font-semibold">{locale === "es" ? "Total estimado" : "Estimated total"}: {money.format(estimatedTotalMinor / unit)}</p>}
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-surface-soft px-4 py-3"><input id="legalAccepted" name="legalAccepted" type="checkbox" required checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-accent" /><label htmlFor="legalAccepted" className="text-xs leading-relaxed text-muted">{locale === "es" ? <>Es un apoyo voluntario, no una compra. Acepto <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-foreground underline">Términos</a> y <a href="/refund-policy" target="_blank" rel="noreferrer" className="font-semibold text-foreground underline">Reembolsos</a>.</> : <>This is voluntary support, not a purchase. I accept the <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-foreground underline">Terms</a> and <a href="/refund-policy" target="_blank" rel="noreferrer" className="font-semibold text-foreground underline">Refunds</a>.</>}</label></div>
    </fieldset>

    {bootstrap?.kind === "redirect" && <button disabled={submitting} className="pressable mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 font-bold text-on-accent hover:bg-accent-strong disabled:opacity-60">{submitting ? <><SpinnerGap size={22} className="animate-spin" /> {locale === "es" ? "Preparando pago" : "Preparing payment"}</> : <><Heart size={21} weight="fill" /> {t.tip.send}</>}</button>}
    </form>
    {bootstrap?.kind === "embedded" && <PayPalCheckout checkout={bootstrap.checkout} locale={locale} createOrder={createEmbeddedOrder} />}
    {bootstrap?.kind === "mercadopago" && quote && <><p className="mt-5 text-center text-xs leading-relaxed text-muted">{locale === "es" ? "Mercado Pago cobrará el equivalente en la moneda local de la cuenta receptora. Tu banco puede aplicar su propia conversión." : "Mercado Pago will charge the equivalent in the recipient account's local currency. Your bank may apply its own conversion."}</p><MercadoPagoCardCheckout key={quote.quoteToken} publicKey={bootstrap.publicKey} country={bootstrap.country} amount={quote.localAmountMinor / 10 ** currencyDigits(quote.currency)} locale={locale} onPay={submitMercadoPago} /></>}
    {bootstrap?.kind === "mercadopago" && !quote && !quoteError && <p className="mt-6 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-surface-soft text-sm font-semibold text-muted"><SpinnerGap size={20} className="animate-spin" /> {locale === "es" ? "Calculando pago seguro" : "Calculating secure payment"}</p>}
    {bootstrap?.kind === "mercadopago" && quoteError && <p role="alert" className="mt-6 rounded-xl bg-surface-soft p-4 text-center text-sm font-semibold text-accent-strong">{locale === "es" ? "No pudimos calcular la conversión. Cambia el monto para reintentar." : "We could not calculate the conversion. Change the amount to try again."}</p>}
    {!bootstrap && !bootstrapError && <p className="mt-6 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-surface-soft text-sm font-semibold text-muted"><SpinnerGap size={20} className="animate-spin" /> {locale === "es" ? "Preparando pago seguro" : "Preparing secure payment"}</p>}
    {bootstrapError && <div className="mt-6 rounded-xl bg-surface-soft p-4 text-center"><p className="text-sm font-semibold text-accent-strong">{locale === "es" ? "No pudimos cargar el pago seguro." : "We could not load secure payment."}</p><button type="button" onClick={() => { setBootstrap(null); setBootstrapError(false); setBootstrapAttempt((value) => value + 1); }} className="pressable mt-3 min-h-10 rounded-full border border-border px-5 text-sm font-semibold hover:border-accent">{locale === "es" ? "Reintentar" : "Try again"}</button></div>}
    {error && <p role="alert" className="mt-4 text-sm font-semibold text-accent-strong">{error}</p>}
    <p className="mt-3 text-center text-xs leading-relaxed text-muted">{locale === "es" ? "El saldo solo cambia cuando el pago es confirmado por el servidor." : "The balance only changes after server confirmation."}</p>
  </div>;
}
