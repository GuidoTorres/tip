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
      { title: "1. Qué es TipMe", paragraphs: ["TipMe es una plataforma tecnológica que facilita apoyos voluntarios entre fans y creadores. TipMe no es un banco, no almacena datos completos de tarjetas y, cuando se usa PayPal, no custodia el dinero del creador."] },
      { title: "2. Naturaleza de los tips", paragraphs: ["Un tip es un apoyo voluntario. No compra contenido, atención, acceso, resultados ni una obligación futura del creador. El fan debe comprobar el perfil y el importe antes de confirmar."] },
      { title: "3. Pagos y comisiones", paragraphs: ["El proveedor de pagos procesa la operación según sus propios términos. Antes de confirmar, se mostrará el monto del tip. Las comisiones de procesamiento y de plataforma aplicables se reflejan en los registros del creador."] },
      { title: "4. Reembolsos y disputas", paragraphs: ["Los tips confirmados no pueden cancelarse desde TipMe. Esto no limita devoluciones aceptadas por el creador ni derechos obligatorios por fraude, error u operación no autorizada. PayPal, el banco o el emisor de la tarjeta pueden investigar y revertir una operación."] },
      { title: "5. Responsabilidades", paragraphs: ["El creador es responsable de su perfil, contenido, obligaciones fiscales y cumplimiento de las reglas del proveedor de pagos. Está prohibido usar TipMe para fraude, suplantación, contenido ilegal, lavado de activos o actividades restringidas."] },
      { title: "6. Disponibilidad y suspensión", paragraphs: ["Podemos limitar o suspender una cuenta para proteger usuarios, investigar abuso, cumplir la ley o atender instrucciones del proveedor de pagos. No garantizamos funcionamiento ininterrumpido de servicios externos."] },
      { title: "7. Cambios y ley aplicable", paragraphs: ["La versión aceptada queda registrada con cada tip. Los cambios futuros no sustituyen retroactivamente esa versión. Se aplicará la legislación obligatoria que corresponda al usuario y al operador de TipMe."] },
    ],
  },
  refunds: {
    title: "Política de reembolsos",
    summary: "Cómo se gestionan solicitudes, errores, fraude y contracargos.",
    sections: [
      { title: "Apoyo voluntario", paragraphs: ["El fan elige libremente el perfil y el monto. Después de la confirmación, TipMe no ofrece una cancelación automática porque el dinero se procesa hacia la cuenta del creador."] },
      { title: "Solicitud voluntaria", paragraphs: ["El fan puede solicitar ayuda indicando el identificador de la operación. El creador puede aceptar una devolución mediante el proveedor de pagos. Toda devolución debe regresar al medio de pago original; nunca debe gestionarse mediante transferencias externas."] },
      { title: "Fraude u operación no autorizada", paragraphs: ["Si el fan no reconoce la operación, debe contactar inmediatamente a PayPal o al emisor de su tarjeta. TipMe cooperará con solicitudes válidas, pero no decide el resultado de una disputa bancaria."] },
      { title: "Reversiones", paragraphs: ["Cuando el proveedor notifique un reembolso o contracargo, TipMe actualizará el estado del tip y el ledger del creador. El creador puede ser responsable del importe revertido y de las comisiones aplicables según su acuerdo con el proveedor."] },
      { title: "Derechos obligatorios", paragraphs: ["Esta política no elimina derechos que la legislación aplicable no permita renunciar."] },
    ],
  },
  privacy: {
    title: "Política de privacidad",
    summary: "Qué información utiliza TipMe y para qué.",
    sections: [
      { title: "Datos tratados", paragraphs: ["De creadores podemos tratar datos de cuenta, perfil, preferencias, identificadores del proveedor de pagos y suscripciones push. De fans tratamos el nombre y mensaje solo si deciden proporcionarlos, además del importe, estado del tip y constancia de aceptación legal."] },
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
      { title: "1. What TipMe is", paragraphs: ["TipMe is a technology platform that facilitates voluntary support between fans and creators. TipMe is not a bank, does not store full card details and, when PayPal is used, does not hold creator funds."] },
      { title: "2. Nature of tips", paragraphs: ["A tip is voluntary support. It does not purchase content, attention, access, results, or a future obligation from the creator. The fan must verify the profile and amount before confirming."] },
      { title: "3. Payments and fees", paragraphs: ["The payment provider processes each transaction under its own terms. The tip amount is shown before confirmation. Applicable processing and platform fees are reflected in creator records."] },
      { title: "4. Refunds and disputes", paragraphs: ["Confirmed tips cannot be cancelled through TipMe. This does not limit creator-approved refunds or mandatory rights involving fraud, error, or unauthorized transactions. PayPal, a bank, or a card issuer may investigate and reverse a transaction."] },
      { title: "5. Responsibilities", paragraphs: ["Creators are responsible for their profile, content, taxes, and compliance with payment-provider rules. TipMe may not be used for fraud, impersonation, illegal content, money laundering, or restricted activities."] },
      { title: "6. Availability and suspension", paragraphs: ["We may limit or suspend an account to protect users, investigate abuse, comply with law, or follow payment-provider instructions. We do not guarantee uninterrupted operation of external services."] },
      { title: "7. Changes and applicable law", paragraphs: ["The version accepted is recorded with each tip. Future changes do not retroactively replace that version. Mandatory laws applicable to the user and the TipMe operator continue to apply."] },
    ],
  },
  refunds: {
    title: "Refund Policy",
    summary: "How requests, errors, fraud, and chargebacks are handled.",
    sections: [
      { title: "Voluntary support", paragraphs: ["The fan freely selects the profile and amount. After confirmation, TipMe does not provide automatic cancellation because funds are processed to the creator's account."] },
      { title: "Voluntary request", paragraphs: ["A fan may request help using the transaction identifier. A creator may approve a refund through the payment provider. Refunds must return to the original payment method and must never be handled through an external transfer."] },
      { title: "Fraud or unauthorized transaction", paragraphs: ["If a fan does not recognize a transaction, they should immediately contact PayPal or their card issuer. TipMe will cooperate with valid requests but does not decide bank disputes."] },
      { title: "Reversals", paragraphs: ["When the provider reports a refund or chargeback, TipMe updates the tip and creator ledger. The creator may be responsible for the reversed amount and applicable fees under their provider agreement."] },
      { title: "Mandatory rights", paragraphs: ["This policy does not remove rights that cannot be waived under applicable law."] },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    summary: "What information TipMe uses and why.",
    sections: [
      { title: "Data processed", paragraphs: ["For creators, we may process account, profile, preference, payment-provider identifier, and push-subscription data. For fans, we process a name and message only when voluntarily provided, together with tip amount, status, and legal acceptance record."] },
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
