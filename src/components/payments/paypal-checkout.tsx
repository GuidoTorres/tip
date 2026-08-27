"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { CreditCard, Heart, PaypalLogo, SpinnerGap } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { createCheckoutAttempt, type CreatedCheckoutAttempt } from "@/features/payments/checkout-attempt";
import type { EmbeddedCheckout } from "@/features/payments/provider";
import type { Locale } from "@/lib/i18n/config";
import { loadPayPalSdk, type PayPalCardFields } from "./paypal-sdk";
import {
  buildApplePayPaymentRequest,
  canUseApplePay,
  getApplePaySession,
  loadApplePaySdk,
  loadPayPalV6Sdk,
  type PayPalV6CardSession,
} from "./paypal-sdk-v6";

type PayPalCheckoutProps = {
  checkout: EmbeddedCheckout;
  locale: Locale;
  amountMinor: number;
  createOrder: () => Promise<CreatedCheckoutAttempt>;
};

export function PayPalCheckout(props: PayPalCheckoutProps) {
  if (props.checkout.sdkVersion === "v6") return <PayPalV6Checkout {...props} />;
  return <PayPalV5Checkout {...props} />;
}

function PayPalV5Checkout({ checkout, locale, createOrder }: PayPalCheckoutProps) {
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
    const sdkPromise = checkout.clientToken
      ? loadPayPalSdk({ ...checkout, clientToken: checkout.clientToken })
      : Promise.reject(new Error("paypal_v5_client_token_missing"));
    sdkPromise.then((paypal) => {
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
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-soft"><PaypalLogo size={25} weight="fill" className="text-[#0070ba]" /></span>
      <div><h2 className="font-semibold leading-tight">{es ? "Pago seguro" : "Secure payment"}</h2><p className="mt-0.5 text-xs text-muted">{es ? "Procesado por PayPal" : "Processed by PayPal"}</p></div>
    </div>
    {cardEligible ? <div className="mt-4 space-y-3">
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
    <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">{es ? "PayPal protege y procesa tus datos de pago." : "PayPal protects and processes your payment details."}</p>
  </section>;
}

function PayPalV6Checkout({ checkout, locale, amountMinor, createOrder }: PayPalCheckoutProps) {
  const es = locale === "es";
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ready" | "confirming" | "rejected" | "error">("loading");
  const [cardEligible, setCardEligible] = useState(true);
  const [paypalEligible, setPaypalEligible] = useState(true);
  const [appleEligible, setAppleEligible] = useState(false);
  const cardSession = useRef<PayPalV6CardSession | null>(null);
  const startPayPalRef = useRef<(() => Promise<void>) | null>(null);
  const attemptRef = useRef<ReturnType<typeof createCheckoutAttempt> | null>(null);
  const createLatestOrder = useEffectEvent(createOrder);

  useEffect(() => {
    let active = true;
    const listeners = new AbortController();
    const attempt = createCheckoutAttempt(() => createLatestOrder());
    attemptRef.current = attempt;

    async function captureAndWait(onCaptured?: (succeeded: boolean) => void) {
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
        onCaptured?.(false);
        attempt.clear();
        setState("rejected");
        return;
      }
      onCaptured?.(true);
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

    async function initialize() {
      const appleDevice = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (appleDevice) await loadApplePaySdk().catch(() => undefined);
      const paypal = await loadPayPalV6Sdk(checkout.environment ?? "live");
      if (!active) return;
      if (!checkout.clientToken) throw new Error("paypal_v6_client_token_missing");
      const sdk = await paypal.createInstance({
        clientToken: checkout.clientToken,
        components: ["paypal-payments", "card-fields", "applepay-payments"],
        pageType: "checkout",
        locale: es ? "es-ES" : "en-US",
        ...(checkout.merchantId ? { merchantId: checkout.merchantId } : {}),
        ...(checkout.partnerAttributionId ? { partnerAttributionId: checkout.partnerAttributionId } : {}),
      });
      const methods = await sdk.findEligibleMethods({
        currencyCode: "USD",
        amount: `${Math.floor(amountMinor / 100)}.${String(amountMinor % 100).padStart(2, "0")}`,
      });
      if (!active) return;

      if (methods.isEligible("advanced_cards")) {
        const session = sdk.createCardFieldsOneTimePaymentSession();
        cardSession.current = session;
        const style = { input: { fontSize: "16px", color: "#231f20" } };
        document.querySelector("#paypal-card-number")?.replaceChildren(session.createCardFieldsComponent({ type: "number", placeholder: es ? "Número de tarjeta" : "Card number", style }));
        document.querySelector("#paypal-card-expiry")?.replaceChildren(session.createCardFieldsComponent({ type: "expiry", placeholder: "MM/AA", style }));
        document.querySelector("#paypal-card-cvv")?.replaceChildren(session.createCardFieldsComponent({ type: "cvv", placeholder: "CVV", style }));
      } else {
        setCardEligible(false);
      }

      if (methods.isEligible("paypal")) {
        const session = sdk.createPayPalOneTimePaymentSession({
          onApprove: () => captureAndWait(),
          onCancel: () => active && setState("ready"),
          onError: () => active && setState("error"),
        });
        const container = document.querySelector("#paypal-button-container");
        const button = document.createElement("paypal-button");
        button.setAttribute("type", "pay");
        button.style.display = "block";
        button.style.width = "100%";
        const startPayPal = () => session.start(
            { presentationMode: "auto" },
            attempt.getOrCreate().then((current) => ({ orderId: current.orderId })),
          ).catch(() => {
            if (active) setState("error");
          });
        startPayPalRef.current = startPayPal;
        button.addEventListener("click", () => void startPayPal(), { signal: listeners.signal });
        container?.replaceChildren(button);
      } else {
        setPaypalEligible(false);
      }

      const appleDetails = methods.isEligible("applepay") ? methods.getDetails("applepay") : undefined;
      if (appleDetails?.config && appleDevice && canUseApplePay()) {
        if (active) {
          setAppleEligible(true);
          const applePay = sdk.createApplePayOneTimePaymentSession();
          const container = document.querySelector("#apple-pay-button-container");
          const button = document.createElement("apple-pay-button");
          button.setAttribute("buttonstyle", "black");
          button.setAttribute("type", "donate");
          button.setAttribute("locale", es ? "es" : "en");
          button.style.display = "block";
          button.style.width = "100%";
          button.addEventListener("click", () => {
            const ApplePaySession = getApplePaySession();
            if (!ApplePaySession) return;
            const request = buildApplePayPaymentRequest({
              amountMinor,
              countryCode: checkout.merchantCountry ?? "PE",
              locale,
              config: applePay.formatConfigForPaymentRequest(appleDetails.config),
            });
            const nativeSession = new ApplePaySession(4, request);
            nativeSession.onvalidatemerchant = ({ validationURL }) => {
              applePay.validateMerchant({ validationUrl: validationURL })
                .then(({ merchantSession }) => nativeSession.completeMerchantValidation(merchantSession))
                .catch(() => nativeSession.abort());
            };
            nativeSession.onpaymentauthorized = async ({ payment }) => {
              try {
                const current = await attempt.getOrCreate();
                await applePay.confirmOrder({ orderId: current.orderId, token: payment.token, billingContact: payment.billingContact });
                await captureAndWait((succeeded) => nativeSession.completePayment({ status: succeeded ? ApplePaySession.STATUS_SUCCESS : ApplePaySession.STATUS_FAILURE }));
              } catch {
                nativeSession.completePayment({ status: ApplePaySession.STATUS_FAILURE });
                if (active) setState("error");
              }
            };
            nativeSession.oncancel = () => active && setState("ready");
            nativeSession.begin();
          }, { signal: listeners.signal });
          container?.replaceChildren(button);
        }
      }
      if (active) setState("ready");
    }

    initialize().catch(() => active && setState("error"));
    return () => {
      active = false;
      listeners.abort();
      cardSession.current = null;
      startPayPalRef.current = null;
      if (attemptRef.current === attempt) attemptRef.current = null;
    };
  }, [amountMinor, checkout, es, locale, router]);

  async function submitCard() {
    if (!cardSession.current || !attemptRef.current) return;
    setState("confirming");
    try {
      const attempt = await attemptRef.current.getOrCreate();
      const result = await cardSession.current.submit(attempt.orderId, {});
      if (result.state === "succeeded") {
        const capture = await fetch(`/api/paypal/tips/${attempt.tipId}/capture`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ receiptToken: attempt.receiptToken }),
        });
        const captureResult = await capture.json().catch(() => ({})) as { status?: string };
        if (!capture.ok) throw new Error("capture_failed");
        if (captureResult.status === "rejected") {
          setState("rejected");
          return;
        }
        router.push(`/tips/${attempt.tipId}/receipt?token=${encodeURIComponent(attempt.receiptToken)}`);
        return;
      }
      setState(result.state === "canceled" ? "ready" : "error");
    } catch {
      setState("error");
    }
  }

  const busy = state === "loading" || state === "confirming";
  return <section className="mt-6 rounded-2xl border border-border bg-background p-4" aria-live="polite">
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-soft"><PaypalLogo size={25} weight="fill" className="text-[#0070ba]" /></span>
      <div><h2 className="font-semibold leading-tight">{es ? "Pago seguro" : "Secure payment"}</h2><p className="mt-0.5 text-xs text-muted">{es ? "Procesado por PayPal" : "Processed by PayPal"}</p></div>
    </div>
    <div id="apple-pay-button-container" className={appleEligible ? "mx-auto mt-4 min-h-12 w-full max-w-sm overflow-hidden rounded-full" : "hidden"} />
    {cardEligible ? <div className="mt-4 space-y-3">
      <PayPalField label={es ? "Número de tarjeta" : "Card number"} id="paypal-card-number" />
      <div className="grid grid-cols-2 gap-3"><PayPalField label={es ? "Vencimiento" : "Expiry"} id="paypal-card-expiry" /><PayPalField label="CVV" id="paypal-card-cvv" /></div>
      <button type="button" disabled={busy} onClick={submitCard} className="pressable flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 font-bold text-on-accent disabled:opacity-60">{busy ? <SpinnerGap className="animate-spin" size={21} /> : <Heart size={21} weight="fill" />} {state === "confirming" ? (es ? "Confirmando pago" : "Confirming payment") : (es ? "ENVIAR TIP" : "SEND TIP")}</button>
    </div> : <p className="mt-4 rounded-xl bg-surface-soft p-3 text-sm leading-relaxed text-muted">{es ? "La tarjeta rápida no está disponible para este pago. Usa el checkout completo de PayPal." : "Quick card payment is unavailable for this payment. Use PayPal's full checkout."}</p>}
    <button
      type="button"
      hidden={cardEligible || !paypalEligible}
      disabled={busy}
      data-hosted-card-fallback="true"
      onClick={() => void startPayPalRef.current?.()}
      className="pressable mt-3 min-h-14 w-full rounded-full border border-[#0070ba] bg-surface px-5 text-foreground hover:bg-surface-soft disabled:opacity-60"
    >
      <span className="flex items-center justify-center gap-3">
        <CreditCard size={22} weight="bold" className="shrink-0 text-[#0070ba]" />
        <span className="flex flex-col text-left leading-tight"><span className="font-bold">{es ? "Pagar con tarjeta" : "Pay with card"}</span><span className="mt-0.5 text-[11px] font-medium text-muted">{es ? "Checkout completo de PayPal" : "Full PayPal checkout"}</span></span>
      </span>
    </button>
    {paypalEligible && <div className="mt-5">
      <div className="flex items-center gap-3 text-xs font-semibold text-muted"><span className="h-px flex-1 bg-border" /><span>{es ? "O paga con" : "Or pay with"}</span><span className="h-px flex-1 bg-border" /></div>
      <div id="paypal-button-container" className="mx-auto mt-3 flex min-h-12 w-full max-w-sm justify-center" />
    </div>}
    {state === "rejected" && <p className="mt-3 text-sm font-semibold text-accent-strong">{es ? "El pago fue rechazado. Prueba otra tarjeta o PayPal." : "The payment was declined. Try another card or PayPal."}</p>}
    {state === "error" && <p className="mt-3 text-sm font-semibold text-accent-strong">{es ? "No pudimos completar este intento. Revisa los datos o inténtalo nuevamente." : "We could not complete this attempt. Check the details or try again."}</p>}
    <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">{es ? "PayPal protege y procesa tus datos de pago." : "PayPal protects and processes your payment details."}</p>
  </section>;
}

function PayPalField({ label, id }: { label: string; id: string }) {
  return <label className="block text-xs font-semibold text-muted">{label}<span id={id} className="mt-1 block min-h-11 rounded-xl border border-border bg-surface px-3 py-2.5" /></label>;
}
