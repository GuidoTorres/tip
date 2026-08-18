"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, SpinnerGap } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import type { CheckoutPresentation } from "@/features/payments/provider";
import type { Locale } from "@/lib/i18n/config";
import { loadPayPalSdk, type PayPalCardFields } from "./paypal-sdk";

type EmbeddedCheckout = Extract<CheckoutPresentation, { kind: "embedded" }>;

export function PayPalCheckout({ tipId, orderId, receiptToken, checkout, locale }: {
  tipId: string; orderId: string; receiptToken: string; checkout: EmbeddedCheckout; locale: Locale;
}) {
  const es = locale === "es";
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ready" | "confirming" | "delayed" | "rejected" | "error">("loading");
  const [cardEligible, setCardEligible] = useState(true);
  const fields = useRef<PayPalCardFields | null>(null);

  useEffect(() => {
    let active = true;
    async function captureAndWait() {
      if (!active) return;
      setState("confirming");
      const capture = await fetch(`/api/paypal/tips/${tipId}/capture`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ receiptToken }) });
      const captureResult = await capture.json().catch(() => ({})) as { status?: string };
      if (!capture.ok) throw new Error("capture_failed");
      if (captureResult.status === "rejected") { setState("rejected"); return; }
      for (let attempt = 0; attempt < 20 && active; attempt += 1) {
        const response = await fetch(`/api/tips/${tipId}/status?token=${encodeURIComponent(receiptToken)}`, { cache: "no-store" });
        const tip = await response.json().catch(() => ({})) as { status?: string };
        if (tip.status === "confirmed") { router.push(`/tips/${tipId}/receipt?token=${encodeURIComponent(receiptToken)}`); return; }
        if (tip.status === "rejected") { setState("rejected"); return; }
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      if (active) setState("delayed");
    }
    loadPayPalSdk(checkout).then((paypal) => {
      if (!active) return;
      const cardFields = paypal.CardFields({
        style: { input: { "font-size": "16px", color: "#231f20" } },
        createOrder: () => Promise.resolve(orderId),
        onApprove: captureAndWait,
        onError: () => active && setState("error"),
        onCancel: () => active && setState("ready"),
      });
      fields.current = cardFields;
      if (cardFields.isEligible()) {
        cardFields.NameField().render("#paypal-card-name");
        cardFields.NumberField().render("#paypal-card-number");
        cardFields.ExpiryField().render("#paypal-card-expiry");
        cardFields.CVVField().render("#paypal-card-cvv");
      } else setCardEligible(false);
      const buttons = paypal.Buttons({
        style: { layout: "vertical", shape: "pill", height: 48, label: "paypal" },
        createOrder: () => Promise.resolve(orderId),
        onApprove: captureAndWait,
        onError: () => active && setState("error"),
        onCancel: () => active && setState("ready"),
      });
      if (buttons.isEligible()) buttons.render("#paypal-button-container");
      setState("ready");
    }).catch(() => active && setState("error"));
    return () => { active = false; };
  }, [checkout, orderId, receiptToken, router, tipId]);

  async function submitCard() {
    try { await fields.current?.submit(); } catch { setState("error"); }
  }

  const busy = state === "loading" || state === "confirming";
  return <section className="mt-6 rounded-2xl border border-border bg-background p-4" aria-live="polite">
    <div className="flex items-center gap-2"><CreditCard size={22} className="text-accent" /><h2 className="font-semibold">{es ? "Pagar de forma segura" : "Pay securely"}</h2></div>
    {cardEligible && <div className="mt-5 space-y-3">
      <PayPalField label={es ? "Nombre del titular" : "Cardholder name"} id="paypal-card-name" />
      <PayPalField label={es ? "Número de tarjeta" : "Card number"} id="paypal-card-number" />
      <div className="grid grid-cols-2 gap-3"><PayPalField label={es ? "Vencimiento" : "Expiry"} id="paypal-card-expiry" /><PayPalField label="CVV" id="paypal-card-cvv" /></div>
      <button type="button" disabled={busy || state === "rejected"} onClick={submitCard} className="pressable flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 font-bold text-on-accent disabled:opacity-60">{busy ? <SpinnerGap className="animate-spin" size={21} /> : <CreditCard size={21} />} {state === "confirming" ? (es ? "Confirmando pago" : "Confirming payment") : (es ? "Pagar con tarjeta" : "Pay by card")}</button>
      <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-border" /><span>{es ? "o" : "or"}</span><span className="h-px flex-1 bg-border" /></div>
    </div>}
    {!cardEligible && <p className="mt-4 rounded-xl bg-surface-soft p-3 text-sm text-muted">{es ? "El pago directo con tarjeta no está disponible para esta cuenta. Puedes usar PayPal." : "Direct card payment is unavailable for this account. You can use PayPal."}</p>}
    <div id="paypal-button-container" className="mt-3 min-h-12" />
    {state === "rejected" && <p className="mt-3 text-sm font-semibold text-accent-strong">{es ? "El pago fue rechazado. Prueba otra tarjeta o PayPal." : "The payment was declined. Try another card or PayPal."}</p>}
    {state === "delayed" && <p className="mt-3 text-sm text-muted">{es ? "PayPal está terminando de confirmar el pago. Tu comprobante se actualizará automáticamente." : "PayPal is still confirming the payment. Your receipt will update automatically."}</p>}
    {state === "error" && <p className="mt-3 text-sm font-semibold text-accent-strong">{es ? "No pudimos cargar el pago seguro. Recarga e inténtalo nuevamente." : "We could not load secure payment. Reload and try again."}</p>}
    <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">{es ? "PayPal procesa este pago. TipMe no recibe los datos de tu tarjeta." : "PayPal processes this payment. TipMe never receives your card details."}</p>
  </section>;
}

function PayPalField({ label, id }: { label: string; id: string }) {
  return <label className="block text-xs font-semibold text-muted">{label}<span id={id} className="mt-1 block min-h-12 rounded-xl border border-border bg-surface px-3 py-3" /></label>;
}
