"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, SpinnerGap } from "@phosphor-icons/react";
import { calculateProcessingSupportMinor } from "@/features/ledger/money";
import { CURRENT_LEGAL_TERMS_VERSION } from "@/features/legal/terms";
import type { CheckoutBootstrap } from "@/features/payments/prepare-checkout";
import type { CheckoutPresentation } from "@/features/payments/provider";
import { PayPalCheckout } from "@/components/payments/paypal-checkout";
import type { CreatedCheckoutAttempt } from "@/features/payments/checkout-attempt";
import { PAYMENT_TIMING_STORAGE_KEY, paymentTimingDebugEnabled } from "@/features/payments/payment-timing";
import type { Currency } from "@/features/payments/types";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

function currencyDigits(currency: Currency) {
  return new Intl.NumberFormat("es", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

function integerToMinor(value: string, digits: number): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const result = Number(normalized) * 10 ** digits;
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
};

type CreatedTip = {
  tipId: string;
  providerPaymentId: string;
  receiptToken: string;
  checkout?: CheckoutPresentation;
  error?: string;
};

function tipStartErrorMessage(code: string | undefined, locale: Locale) {
  if (locale === "es") {
    if (code === "paypal_account_not_connected") return "Esta creadora todavía no tiene configurado su correo PayPal de retiro.";
    if (code === "creator_not_found") return "No encontramos esa página pública.";
    return "No pudimos iniciar el tip. Comprueba tu conexión.";
  }
  if (code === "paypal_account_not_connected") return "This creator has not configured a PayPal withdrawal email yet.";
  if (code === "creator_not_found") return "We could not find that public page.";
  return "We could not start the tip. Check your connection.";
}

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
  const [submitting, setSubmitting] = useState(false);
  const [checkoutLocked, setCheckoutLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<CheckoutBootstrap | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [checkoutBootstrapMs, setCheckoutBootstrapMs] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = performance.now();
    if (paymentTimingDebugEnabled(window.location.search)) {
      try { sessionStorage.removeItem(PAYMENT_TIMING_STORAGE_KEY); } catch { /* Storage can be unavailable in private browsing. */ }
    }
    fetch(`/api/payments/checkout-config?username=${encodeURIComponent(username)}`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json().catch(() => null) as CheckoutBootstrap | null;
      if (!response.ok || !data || !["redirect", "embedded"].includes(data.kind)) throw new Error((data as { error?: string } | null)?.error || "checkout_unavailable");
      if (data.kind === "embedded" && data.checkout.kind !== "embedded") throw new Error("checkout_unavailable");
      setCheckoutBootstrapMs(Math.max(0, Math.round(performance.now() - startedAt)));
      setBootstrap(data);
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setBootstrapError(reason instanceof Error ? reason.message : "checkout_unavailable");
    });
    return () => controller.abort();
  }, [bootstrapAttempt, username]);

  const selectedAmount = showCustom ? integerToMinor(custom, digits) : amountMinor;
  const supportMinor = coverProcessing && selectedAmount && selectedAmount > 0
    ? calculateProcessingSupportMinor(selectedAmount, checkoutFeeBps, checkoutFixedFeeMinor)
    : 0;
  const estimatedTotalMinor = (selectedAmount ?? 0) + supportMinor;
  const money = new Intl.NumberFormat(locale === "es" ? "es-PE" : "en-US", { style: "currency", currency });

  function buildPayload(): TipPayload {
    const form = formRef.current;
    if (!form || !form.reportValidity()) throw new Error("invalid_tip_form");
    const finalAmount = showCustom ? integerToMinor(custom, digits) : amountMinor;
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
      legalAccepted: true,
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

  async function submitRedirect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bootstrap?.kind !== "redirect") return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await createTipRequest(buildPayload());
      if (data.checkout?.kind !== "redirect") throw new Error("redirect_unavailable");
      window.location.assign(data.checkout.url);
    } catch (reason) {
      setError(tipStartErrorMessage(reason instanceof Error ? reason.message : undefined, locale));
      setSubmitting(false);
    }
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
        setError(tipStartErrorMessage(reason.message, locale));
      }
      throw reason;
    }
  }

  const legalNotice = <p className="mt-3 text-center text-xs leading-relaxed text-muted">{locale === "es" ? <>Este tip es un apoyo voluntario y agradece contenido que esta creadora ya compartió. No compra contenido adicional, acceso ni garantiza una respuesta. Los tips <a href="/refund-policy" target="_blank" rel="noreferrer" className="inline-block py-1 font-semibold text-foreground underline">generalmente no son reembolsables</a>. Revisa los <a href="/terms" target="_blank" rel="noreferrer" className="inline-block py-1 font-semibold text-foreground underline">términos</a> antes de pagar.</> : <>This tip is voluntary support for content the creator already shared. It does not purchase additional content or access or guarantee a response. Tips are <a href="/refund-policy" target="_blank" rel="noreferrer" className="inline-block py-1 font-semibold text-foreground underline">generally non-refundable</a>. Review the <a href="/terms" target="_blank" rel="noreferrer" className="inline-block py-1 font-semibold text-foreground underline">terms</a> before paying.</>}</p>;

  return <div className="mt-8"><form ref={formRef} onSubmit={submitRedirect}>
    <fieldset disabled={submitting || checkoutLocked}>
      <legend className="text-lg font-semibold">{t.tip.heading}</legend>
      <p className="mt-1 text-xs text-muted">{t.tip.currencyNotice}</p>
      <div className="mt-3 grid grid-cols-5 gap-1.5">{presets.map((amount) => <button key={amount} type="button" onClick={() => { setAmountMinor(amount); setShowCustom(false); }} className={`pressable min-h-11 rounded-lg border px-2 text-sm font-bold ${!showCustom && amountMinor === amount ? "border-accent bg-accent-strong text-on-accent" : "border-border bg-background hover:border-accent"}`}>{amount / unit}</button>)}{showCustom ? <input autoFocus inputMode="numeric" pattern="[0-9]+" value={custom} onChange={(event) => setCustom(event.target.value.replace(/\D/g, ""))} aria-label={locale === "es" ? "Otro monto" : "Other amount"} placeholder={locale === "es" ? "Otro" : "Other"} className="min-h-11 w-full rounded-lg border border-accent bg-background px-1 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-accent-strong/40" /> : <button type="button" onClick={() => setShowCustom(true)} className="pressable min-h-11 rounded-lg border border-border px-1 text-sm font-semibold hover:border-accent">{locale === "es" ? "Otro" : "Other"}</button>}</div>
      <div className="mt-6 space-y-4">
        <details className="rounded-xl border border-border bg-surface-soft px-4">
          <summary className="pressable cursor-pointer py-3 text-sm font-semibold">{locale === "es" ? "Añadir nombre o mensaje (opcional)" : "Add name or message (optional)"}</summary>
          <div className="space-y-3 pb-4">
            <label className="block text-sm font-semibold">{t.tip.name}<input name="payerName" maxLength={60} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent" /></label>
            <label className="block text-sm font-semibold">{t.tip.message}<textarea name="message" rows={2} maxLength={280} className="mt-2 min-h-14 w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 outline-none focus:border-accent" placeholder="Para ti ❤️" /></label>
          </div>
        </details>
        {allowProcessingSupport && <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3"><input type="checkbox" checked={coverProcessing} onChange={(event) => setCoverProcessing(event.target.checked)} className="size-5 shrink-0 accent-accent" /><span className="text-sm font-semibold">{locale === "es" ? "Ayudar con la comisión de pago" : "Help with the payment fee"}</span></label>}
        {coverProcessing && estimatedTotalMinor > 0 && <p className="text-right text-sm font-semibold">{locale === "es" ? "Total estimado" : "Estimated total"}: {money.format(estimatedTotalMinor / unit)}</p>}
      </div>
    </fieldset>

    {bootstrap?.kind === "redirect" && <button disabled={submitting} className="pressable mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent-strong px-6 py-4 font-bold text-on-accent hover:bg-accent-pressed disabled:opacity-60">{submitting ? <><SpinnerGap size={22} className="animate-spin" /> {locale === "es" ? "Preparando pago" : "Preparing payment"}</> : <><Heart size={21} weight="fill" /> {t.tip.send}</>}</button>}
    </form>
    {bootstrap?.kind === "embedded" && <PayPalCheckout checkout={bootstrap.checkout} locale={locale} amountMinor={estimatedTotalMinor} createOrder={createEmbeddedOrder} bootstrapDurationMs={checkoutBootstrapMs} />}
    {legalNotice}
    {!bootstrap && !bootstrapError && <p className="mt-6 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-surface-soft text-sm font-semibold text-muted"><SpinnerGap size={20} className="animate-spin" /> {locale === "es" ? "Preparando pago seguro" : "Preparing secure payment"}</p>}
    {bootstrapError && <div className="mt-6 rounded-xl bg-surface-soft p-4 text-center"><p className="text-sm font-semibold text-accent-strong">{tipStartErrorMessage(bootstrapError, locale)}</p><button type="button" onClick={() => { setBootstrap(null); setBootstrapError(null); setCheckoutBootstrapMs(null); setBootstrapAttempt((value) => value + 1); }} className="pressable mt-3 min-h-10 rounded-full border border-border px-5 text-sm font-semibold hover:border-accent">{locale === "es" ? "Reintentar" : "Try again"}</button></div>}
    {error && <p role="alert" className="mt-4 text-sm font-semibold text-accent-strong">{error}</p>}
  </div>;
}
