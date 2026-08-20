"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { CreditCard, Heart, SpinnerGap } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { createCheckoutAttempt, type CreatedCheckoutAttempt } from "@/features/payments/checkout-attempt";
import type { EmbeddedCheckout } from "@/features/payments/provider";
import type { Locale } from "@/lib/i18n/config";
import { loadPayPalSdk, type PayPalCardFields } from "./paypal-sdk";

type PayPalCheckoutProps = {
  checkout: EmbeddedCheckout;
  locale: Locale;
  createOrder: () => Promise<CreatedCheckoutAttempt>;
};

export function PayPalCheckout({ checkout, locale, createOrder }: PayPalCheckoutProps) {
  const es = locale === "es";
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ready" | "confirming" | "rejected" | "error">("loading");
  const [cardEligible, setCardEligible] = useState(true);
  const [paypalEligible, setPaypalEligible] = useState(true);
  const fields = useRef<PayPalCardFields | null>(null);
  const createLatestOrder = useEffectEvent(createOrder);

  useEffect(() => {
    let active = true;
    const attempt = createCheckoutAttempt(() => createLatestOrder());

    async function captureAndWait() {
      if (!active) return;
      setState("confirming");
      const current = await attempt.getOrCreate();
      const capture = await fetch(`/api/paypal/tips/${current.tipId}/capture`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receiptToken: current.receiptToken }),
      });
      const captureResult = await capture.json().catch(() => ({})) as { status?: string };
      if (!capture.ok) throw new Error("capture_failed");
      if (captureResult.status === "rejected") {
        attempt.clear();
        setState("rejected");
        return;
      }
      for (let poll = 0; poll < 20 && active; poll += 1) {
        const response = await fetch(`/api/tips/${current.tipId}/status?token=${encodeURIComponent(current.receiptToken)}`, { cache: "no-store" });
        const tip = await response.json().catch(() => ({})) as { status?: string };
        if (tip.status === "confirmed") {
          router.push(`/tips/${current.tipId}/receipt?token=${encodeURIComponent(current.receiptToken)}`);
          return;
        }
        if (tip.status === "rejected") {
          attempt.clear();
          setState("rejected");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      if (active) router.push(`/tips/${current.tipId}/receipt?token=${encodeURIComponent(current.receiptToken)}`);
    }

    const sdkCreateOrder = async () => (await attempt.getOrCreate()).orderId;
    loadPayPalSdk(checkout).then((paypal) => {
      if (!active) return;
      const cardFields = paypal.CardFields({
        style: { input: { "font-size": "16px", color: "#231f20" } },
        createOrder: sdkCreateOrder,
        onApprove: captureAndWait,
        onError: () => active && setState("error"),
        onCancel: () => active && setState("ready"),
      });
      fields.current = cardFields;
      if (cardFields.isEligible()) {
        cardFields.NumberField().render("#paypal-card-number");
        cardFields.ExpiryField().render("#paypal-card-expiry");
        cardFields.CVVField().render("#paypal-card-cvv");
      } else {
        setCardEligible(false);
      }

      const buttons = paypal.Buttons({
        style: { layout: "vertical", shape: "pill", height: 48, label: "paypal" },
        createOrder: sdkCreateOrder,
        onApprove: captureAndWait,
        onError: () => active && setState("error"),
        onCancel: () => active && setState("ready"),
      });
      if (buttons.isEligible()) buttons.render("#paypal-button-container");
      else setPaypalEligible(false);
      setState("ready");
    }).catch(() => active && setState("error"));

    return () => {
      active = false;
      fields.current = null;
    };
  }, [checkout, router]);

  async function submitCard() {
    if (!fields.current) return;
    setState("ready");
    try {
      await fields.current.submit();
    } catch {
      setState("error");
    }
  }

  const busy = state === "loading" || state === "confirming";
  return <section className="mt-6 rounded-2xl border border-border bg-background p-4" aria-live="polite">
    <div className="flex items-center gap-2"><CreditCard size={22} className="text-accent" /><h2 className="font-semibold">{es ? "Pagar de forma segura" : "Pay securely"}</h2></div>
    {cardEligible ? <div className="mt-5 space-y-3">
      <PayPalField label={es ? "Número de tarjeta" : "Card number"} id="paypal-card-number" />
      <div className="grid grid-cols-2 gap-3"><PayPalField label={es ? "Vencimiento" : "Expiry"} id="paypal-card-expiry" /><PayPalField label="CVV" id="paypal-card-cvv" /></div>
      <button type="button" disabled={busy} onClick={submitCard} className="pressable flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 font-bold text-on-accent disabled:opacity-60">{busy ? <SpinnerGap className="animate-spin" size={21} /> : <Heart size={21} weight="fill" />} {state === "confirming" ? (es ? "Confirmando pago" : "Confirming payment") : (es ? "ENVIAR TIP" : "SEND TIP")}</button>
    </div> : <p className="mt-4 rounded-xl bg-surface-soft p-3 text-sm leading-relaxed text-muted">{es ? "La tarjeta directa no está disponible para este pago. Puedes continuar con PayPal." : "Direct card payment is unavailable for this payment. You can continue with PayPal."}</p>}
    {paypalEligible && <div className="mt-5">
      <div className="flex items-center gap-3 text-xs font-semibold text-muted"><span className="h-px flex-1 bg-border" /><span>{es ? "O paga con" : "Or pay with"}</span><span className="h-px flex-1 bg-border" /></div>
      <div id="paypal-button-container" className="mt-3 min-h-12" />
    </div>}
    {state === "rejected" && <p className="mt-3 text-sm font-semibold text-accent-strong">{es ? "El pago fue rechazado. Prueba otra tarjeta o PayPal." : "The payment was declined. Try another card or PayPal."}</p>}
    {state === "error" && <p className="mt-3 text-sm font-semibold text-accent-strong">{es ? "No pudimos completar este intento. Revisa los datos o inténtalo nuevamente." : "We could not complete this attempt. Check the details or try again."}</p>}
    <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">{es ? "PayPal procesa este pago. TipMe no recibe los datos de tu tarjeta." : "PayPal processes this payment. TipMe never receives your card details."}</p>
  </section>;
}

function PayPalField({ label, id }: { label: string; id: string }) {
  return <label className="block text-xs font-semibold text-muted">{label}<span id={id} className="mt-1 block min-h-12 rounded-xl border border-border bg-surface px-3 py-3" /></label>;
}
