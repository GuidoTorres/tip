"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CardPayment, initMercadoPago, useCardPaymentBrick } from "@mercadopago/sdk-react";
import { SpinnerGap } from "@phosphor-icons/react";
import type { TCardPayment, ICardPaymentFormData, ICardPaymentBrickPayer } from "@mercadopago/sdk-react/esm/bricks/cardPayment/type";
import type { Locale } from "@/lib/i18n/config";
import type { MercadoPagoCardPaymentData } from "@/features/payments/provider";
import { getMercadoPagoCountryOption, type MercadoPagoCountry } from "@/features/payments/mercadopago-regions";
import { useRouter } from "next/navigation";

// El brick se re-inicializa cuando cambia cualquiera de sus props, así que todas
// deben mantener identidad estable entre renders. El monto se propaga con
// `update()` en lugar de remontar: así el fan no pierde lo que ya escribió.
const CARD_CUSTOMIZATION: NonNullable<TCardPayment["customization"]> = {
  paymentMethods: { types: { included: ["credit_card", "debit_card", "prepaid_card"] } },
  visual: { hideFormTitle: false },
};

export function MercadoPagoCardCheckout({ publicKey, country, amount, locale, onPay, children }: {
  publicKey: string;
  country: MercadoPagoCountry;
  amount: number;
  locale: Locale;
  onPay: (data: MercadoPagoCardPaymentData) => Promise<{ tipId: string; receiptToken: string }>;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const mercadoPagoLocale = getMercadoPagoCountryOption(country).locale;
  const [ready] = useState(() => {
    initMercadoPago(publicKey, { locale: mercadoPagoLocale });
    return true;
  });
  const [error, setError] = useState(false);
  const [processing, setProcessing] = useState(false);

  // El brick se monta una sola vez con el importe inicial; los cambios posteriores
  // viajan por update() para no destruir el formulario.
  const [mountAmount] = useState(amount);
  const initialization = useMemo(() => ({ amount: mountAmount }), [mountAmount]);
  const { update } = useCardPaymentBrick();
  const appliedAmount = useRef(mountAmount);

  useEffect(() => {
    if (amount <= 0 || amount === appliedAmount.current) return;
    appliedAmount.current = amount;
    update({ amount });
  }, [amount, update]);

  // onPay cambia de identidad en cada render del padre: se lee desde una ref para
  // que `submit` permanezca estable y no dispare el efecto del SDK.
  const onPayRef = useRef(onPay);
  useEffect(() => { onPayRef.current = onPay; }, [onPay]);

  const submit = useCallback(async (data: ICardPaymentFormData<ICardPaymentBrickPayer>) => {
    setError(false);
    setProcessing(true);
    try {
      if (!data.payer.email) throw new Error("payer_email_missing");
      const result = await onPayRef.current({
        token: data.token,
        paymentMethodId: data.payment_method_id,
        issuerId: data.issuer_id || null,
        installments: data.installments,
        payer: {
          email: data.payer.email,
          ...(data.payer.identification?.type && data.payer.identification?.number
            ? { identification: { type: data.payer.identification.type, number: data.payer.identification.number } }
            : {}),
        },
      });
      router.push(`/tips/${result.tipId}/receipt?token=${encodeURIComponent(result.receiptToken)}`);
    } catch (reason) {
      setProcessing(false);
      setError(true);
      throw reason;
    }
  }, [router]);

  const handleError = useCallback(() => {
    setProcessing(false);
    setError(true);
  }, []);

  return <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface" aria-live="polite">
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <p className="text-sm font-semibold">{locale === "es" ? "Pago seguro" : "Secure payment"}</p>
      {/* Sustituir por el SVG oficial de Mercado Pago cuando esté disponible en /public. */}
      <span className="shrink-0 whitespace-nowrap text-sm font-bold text-[#007eb5]">Mercado Pago</span>
    </div>
    <div className="px-2 pb-2">
    {ready && amount > 0 && !processing && <CardPayment
      initialization={initialization}
      customization={CARD_CUSTOMIZATION}
      locale={mercadoPagoLocale}
      onSubmit={submit}
      onError={handleError}
    />}
    {processing && <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-surface-soft px-4 py-3 text-sm font-semibold text-muted" role="status" aria-live="polite"><SpinnerGap size={19} className="animate-spin" />{locale === "es" ? "Procesando pago seguro…" : "Processing secure payment…"}</div>}
    {error && <p role="alert" className="px-2 pb-2 text-sm font-semibold text-accent-strong">{locale === "es" ? "No pudimos procesar este pago. Revisa los datos e inténtalo nuevamente." : "We could not process this payment. Check the details and try again."}</p>}
    {children}
    </div>
  </section>;
}
