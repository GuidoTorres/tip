"use client";

import { useState } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import type { ICardPaymentFormData, ICardPaymentBrickPayer } from "@mercadopago/sdk-react/esm/bricks/cardPayment/type";
import type { Locale } from "@/lib/i18n/config";
import type { MercadoPagoCardPaymentData } from "@/features/payments/provider";
import { getMercadoPagoCountryOption, type MercadoPagoCountry } from "@/features/payments/mercadopago-regions";
import { useRouter } from "next/navigation";

export function MercadoPagoCardCheckout({ publicKey, country, amount, locale, onPay }: {
  publicKey: string;
  country: MercadoPagoCountry;
  amount: number;
  locale: Locale;
  onPay: (data: MercadoPagoCardPaymentData) => Promise<{ tipId: string; receiptToken: string }>;
}) {
  const router = useRouter();
  const mercadoPagoLocale = getMercadoPagoCountryOption(country).locale;
  const [ready] = useState(() => {
    initMercadoPago(publicKey, { locale: mercadoPagoLocale });
    return true;
  });
  const [error, setError] = useState(false);

  async function submit(data: ICardPaymentFormData<ICardPaymentBrickPayer>) {
    setError(false);
    try {
      if (!data.payer.email) throw new Error("payer_email_missing");
      const result = await onPay({
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
      setError(true);
      throw reason;
    }
  }

  return <section className="mt-6 rounded-2xl border border-border bg-background p-3" aria-live="polite">
    <div className="mb-2 flex items-center justify-between px-2"><div><h2 className="font-semibold">{locale === "es" ? "Pago seguro" : "Secure payment"}</h2><p className="text-xs text-muted">{locale === "es" ? "Procesado por Mercado Pago" : "Processed by Mercado Pago"}</p></div><span className="rounded-lg bg-[#009ee3] px-2.5 py-1 text-xs font-bold text-white">mercado pago</span></div>
    {ready && amount > 0 && <CardPayment
      initialization={{ amount }}
      customization={{ paymentMethods: { types: { included: ["credit_card", "debit_card", "prepaid_card"] } }, visual: { hideFormTitle: false } }}
      locale={mercadoPagoLocale}
      onSubmit={submit}
      onError={() => setError(true)}
    />}
    {error && <p role="alert" className="px-2 pb-2 text-sm font-semibold text-accent-strong">{locale === "es" ? "No pudimos procesar este pago. Revisa los datos e inténtalo nuevamente." : "We could not process this payment. Check the details and try again."}</p>}
  </section>;
}
