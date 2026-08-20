import type { Locale } from "@/lib/i18n/config";

export type LegalDocument = {
  title: string;
  summary: string;
  sections: Array<{ title: string; paragraphs: string[] }>;
};

const es = {
  terms: {
    title: "Términos de uso",
    summary: "Estas reglas regulan el uso de TipMe por fans y creadores.",
    sections: [
      { title: "1. Qué es TipMe", paragraphs: ["TipMe es una plataforma tecnológica que facilita apoyos voluntarios entre fans y creadores. En el modo PayPal del piloto, los cobros se reciben en la cuenta del operador de TipMe, se atribuyen a cada creador mediante un ledger y se envían después mediante PayPal Payouts. TipMe no es un banco ni ofrece una cuenta de depósito."] },
      { title: "2. Naturaleza de los tips", paragraphs: ["Un tip es un apoyo voluntario. No compra contenido, atención, acceso, resultados ni una obligación futura del creador. El fan debe comprobar el perfil y el importe antes de confirmar."] },
      { title: "3. Pagos, saldo y comisiones", paragraphs: ["PayPal procesa cobros y retiros bajo sus propios términos. El saldo de TipMe es un registro contable derivado y no garantiza que PayPal libere fondos inmediatamente. Durante el piloto TipMe cobra 0% de comisión de plataforma; se descuentan las comisiones reales de cobro y retiro informadas por PayPal. Un aporte del fan para procesamiento es voluntario y estimado."] },
      { title: "4. Reembolsos y disputas", paragraphs: ["Los tips confirmados no pueden cancelarse automáticamente desde TipMe. Esto no limita derechos obligatorios por fraude, error u operación no autorizada. PayPal, el banco o el emisor pueden investigar, retener o revertir una operación. Un reembolso o contracargo se descuenta del ledger del creador y puede generar saldo negativo si el dinero ya fue retirado."] },
      { title: "5. Responsabilidades", paragraphs: ["El creador es responsable de su perfil, contenido, obligaciones fiscales y cumplimiento de las reglas del proveedor de pagos. Está prohibido usar TipMe para fraude, suplantación, contenido ilegal, lavado de activos o actividades restringidas."] },
      { title: "6. Disponibilidad y suspensión", paragraphs: ["Podemos limitar o suspender una cuenta para proteger usuarios, investigar abuso, cumplir la ley o atender instrucciones del proveedor de pagos. No garantizamos funcionamiento ininterrumpido de servicios externos."] },
      { title: "7. Cambios y ley aplicable", paragraphs: ["La versión aceptada queda registrada con cada tip. Los cambios futuros no sustituyen retroactivamente esa versión. Se aplicará la legislación obligatoria que corresponda al usuario y al operador de TipMe."] },
    ],
  },
  refunds: {
    title: "Política de reembolsos",
    summary: "Cómo se gestionan solicitudes, errores, fraude y contracargos.",
    sections: [
      { title: "Apoyo voluntario", paragraphs: ["El fan elige libremente el perfil y el monto. Después de la confirmación, TipMe no ofrece una cancelación automática porque PayPal ya procesó el cobro."] },
      { title: "Solicitud voluntaria", paragraphs: ["El fan puede solicitar ayuda indicando el identificador de la operación. Si corresponde una devolución, TipMe debe tramitarla sobre la captura original de PayPal. Nunca se devuelve mediante una transferencia externa ni a un medio distinto."] },
      { title: "Fraude u operación no autorizada", paragraphs: ["Si el fan no reconoce la operación, debe contactar inmediatamente a PayPal o al emisor de su tarjeta. TipMe cooperará con solicitudes válidas, pero no decide el resultado de una disputa bancaria."] },
      { title: "Reversiones", paragraphs: ["Cuando PayPal notifique un reembolso o contracargo, TipMe actualizará el tip y el ledger. El creador puede ser responsable del importe revertido y de las comisiones aplicables; si ya retiró el dinero, su saldo puede quedar negativo y futuros tips se aplicarán primero a esa deuda."] },
      { title: "Derechos obligatorios", paragraphs: ["Esta política no elimina derechos que la legislación aplicable no permita renunciar."] },
    ],
  },
  privacy: {
    title: "Política de privacidad",
    summary: "Qué información utiliza TipMe y para qué.",
    sections: [
      { title: "Datos tratados", paragraphs: ["De creadores podemos tratar datos de cuenta, perfil, preferencias, correo de destino PayPal, identificadores del proveedor de pagos y suscripciones push. De fans tratamos el nombre y mensaje solo si deciden proporcionarlos, además del importe, estado del tip y constancia de aceptación legal."] },
      { title: "Datos de pago", paragraphs: ["TipMe no recibe números completos de tarjeta, CVV, contraseñas bancarias ni credenciales de PayPal. Esos datos son tratados por el proveedor de pagos."] },
      { title: "Finalidades", paragraphs: ["Usamos la información para crear y confirmar tips, mantener el ledger, prevenir fraude, enviar notificaciones, atender soporte y cumplir obligaciones legales."] },
      { title: "Proveedores", paragraphs: ["Utilizamos proveedores como Supabase, Vercel y PayPal para operar la plataforma. Pueden tratar datos en otros países conforme a sus contratos y políticas."] },
      { title: "Conservación y seguridad", paragraphs: ["Conservamos registros financieros y de seguridad durante el tiempo necesario para operar, resolver disputas y cumplir la ley. Aplicamos controles de acceso, validación server-side y separación de secretos."] },
      { title: "Derechos", paragraphs: ["Puedes solicitar acceso, corrección o eliminación cuando corresponda. Algunos registros financieros no pueden eliminarse inmediatamente por obligaciones legales, antifraude o defensa ante reclamaciones."] },
    ],
  },
} satisfies Record<string, LegalDocument>;

const en: typeof es = {
  terms: {
    title: "Terms of Use",
    summary: "These rules govern the use of TipMe by fans and creators.",
    sections: [
      { title: "1. What TipMe is", paragraphs: ["TipMe is a technology platform that facilitates voluntary support between fans and creators. In the pilot PayPal mode, charges are received in the TipMe operator's account, attributed to each creator through a ledger, and later sent through PayPal Payouts. TipMe is not a bank and does not offer deposit accounts."] },
      { title: "2. Nature of tips", paragraphs: ["A tip is voluntary support. It does not purchase content, attention, access, results, or a future obligation from the creator. The fan must verify the profile and amount before confirming."] },
      { title: "3. Payments, balance, and fees", paragraphs: ["PayPal processes charges and payouts under its own terms. A TipMe balance is a derived accounting record and does not guarantee immediate release of funds by PayPal. TipMe charges a 0% platform fee during the pilot; actual PayPal charge and payout fees are deducted. A fan's processing contribution is optional and estimated."] },
      { title: "4. Refunds and disputes", paragraphs: ["Confirmed tips cannot be cancelled automatically through TipMe. This does not limit mandatory rights involving fraud, error, or unauthorized transactions. PayPal, a bank, or a card issuer may investigate, hold, or reverse a transaction. A refund or chargeback is debited from the creator ledger and may create a negative balance after withdrawal."] },
      { title: "5. Responsibilities", paragraphs: ["Creators are responsible for their profile, content, taxes, and compliance with payment-provider rules. TipMe may not be used for fraud, impersonation, illegal content, money laundering, or restricted activities."] },
      { title: "6. Availability and suspension", paragraphs: ["We may limit or suspend an account to protect users, investigate abuse, comply with law, or follow payment-provider instructions. We do not guarantee uninterrupted operation of external services."] },
      { title: "7. Changes and applicable law", paragraphs: ["The version accepted is recorded with each tip. Future changes do not retroactively replace that version. Mandatory laws applicable to the user and the TipMe operator continue to apply."] },
    ],
  },
  refunds: {
    title: "Refund Policy",
    summary: "How requests, errors, fraud, and chargebacks are handled.",
    sections: [
      { title: "Voluntary support", paragraphs: ["The fan freely selects the profile and amount. After confirmation, TipMe does not provide automatic cancellation because PayPal has already processed the charge."] },
      { title: "Voluntary request", paragraphs: ["A fan may request help using the transaction identifier. When a refund applies, TipMe must process it against the original PayPal capture. It must never be sent through an external transfer or to a different payment method."] },
      { title: "Fraud or unauthorized transaction", paragraphs: ["If a fan does not recognize a transaction, they should immediately contact PayPal or their card issuer. TipMe will cooperate with valid requests but does not decide bank disputes."] },
      { title: "Reversals", paragraphs: ["When PayPal reports a refund or chargeback, TipMe updates the tip and ledger. The creator may be responsible for the reversed amount and applicable fees; after withdrawal this can create a negative balance, and future tips are first applied to that debt."] },
      { title: "Mandatory rights", paragraphs: ["This policy does not remove rights that cannot be waived under applicable law."] },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    summary: "What information TipMe uses and why.",
    sections: [
      { title: "Data processed", paragraphs: ["For creators, we may process account, profile, preference, PayPal destination email, payment-provider identifier, and push-subscription data. For fans, we process a name and message only when voluntarily provided, together with tip amount, status, and legal acceptance record."] },
      { title: "Payment data", paragraphs: ["TipMe does not receive full card numbers, CVVs, bank passwords, or PayPal credentials. The payment provider processes that information."] },
      { title: "Purposes", paragraphs: ["We use information to create and confirm tips, maintain the ledger, prevent fraud, deliver notifications, provide support, and comply with legal obligations."] },
      { title: "Providers", paragraphs: ["We use providers such as Supabase, Vercel, and PayPal to operate the platform. They may process data in other countries under their contracts and policies."] },
      { title: "Retention and security", paragraphs: ["We retain financial and security records as needed to operate, resolve disputes, and comply with law. We use access controls, server-side validation, and secret separation."] },
      { title: "Rights", paragraphs: ["You may request access, correction, or deletion where applicable. Some financial records cannot be deleted immediately because of legal, fraud-prevention, or claims-defense requirements."] },
    ],
  },
};

export function getLegalDocuments(locale: Locale) {
  return locale === "en" ? en : es;
}
