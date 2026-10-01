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
      { title: "1. Qué es TipMe", paragraphs: ["TipMe es una herramienta tecnológica para que creadores identificados reciban apoyo económico voluntario de su audiencia mediante una página propia. El proveedor de pagos activo procesa cada operación bajo sus términos. TipMe no es un banco, no ofrece cuentas de depósito ni permite enviar dinero a usuarios arbitrarios."] },
      { title: "2. Naturaleza de los tips", paragraphs: ["Un tip es un apoyo voluntario para agradecer contenido permitido que el creador ya compartió en plataformas externas. No compra ni garantiza contenido adicional, mensajes, atención, acceso, productos, servicios, beneficios, resultados o una obligación futura del creador. El fan debe comprobar el perfil público y el importe antes de confirmar."] },
      { title: "3. Pagos, saldo y comisiones", paragraphs: ["El proveedor de pagos activo procesa los cobros bajo sus propios términos. TipMe no ofrece al fan saldos almacenados, recargas, monedas virtuales ni transferencias entre particulares. El saldo mostrado al creador es un registro derivado de pagos confirmados. TipMe informa su comisión antes del pago; el proveedor puede descontar sus propias comisiones y determinar la disponibilidad o los retiros."] },
      { title: "4. Reembolsos y disputas", paragraphs: ["Los tips confirmados no pueden cancelarse automáticamente desde TipMe. Esto no limita derechos obligatorios por fraude, error u operación no autorizada. El proveedor de pagos, el banco o el emisor pueden investigar, retener o revertir una operación. Un reembolso o contracargo se descuenta del ledger del creador y puede generar saldo negativo si el dinero ya fue retirado."] },
      { title: "5. Responsabilidades y usos prohibidos", paragraphs: ["El creador es responsable de la autenticidad de su perfil y red social pública, de sus obligaciones fiscales y del cumplimiento de las reglas del proveedor de pagos. Está prohibido usar TipMe para transferencias entre particulares, remesas, fraude, suplantación, lavado de activos, contenido o servicios para adultos, venta o desbloqueo de contenido, interacciones privadas pagadas u otras actividades ilegales o restringidas."] },
      { title: "6. Disponibilidad y suspensión", paragraphs: ["Podemos limitar o suspender una cuenta para proteger usuarios, investigar abuso, cumplir la ley o atender instrucciones del proveedor de pagos. No garantizamos funcionamiento ininterrumpido de servicios externos."] },
      { title: "7. Cambios y ley aplicable", paragraphs: ["La versión aceptada queda registrada con cada tip. Los cambios futuros no sustituyen retroactivamente esa versión. Se aplicará la legislación obligatoria que corresponda al usuario y al operador de TipMe."] },
    ],
  },
  refunds: {
    title: "Política de reembolsos",
    summary: "Los tips confirmados son voluntarios y generalmente no reembolsables.",
    sections: [
      { title: "Apoyo voluntario y no reembolsable", paragraphs: ["Los tips realizados a través de TipMe son aportes voluntarios. Una vez confirmados, no son reembolsables, salvo cuando corresponda por fraude, error técnico, operación no autorizada, contracargo u obligación legal aplicable."] },
      { title: "Solicitudes excepcionales", paragraphs: ["El fan puede solicitar ayuda indicando el código de operación. Cuando corresponda una devolución, debe tramitarse sobre el pago original mediante el proveedor. Nunca se devuelve mediante una transferencia externa ni a un medio distinto."] },
      { title: "Fraude u operación no autorizada", paragraphs: ["Si el fan no reconoce la operación, debe contactar inmediatamente al proveedor de pagos indicado en su comprobante o al emisor de su tarjeta. TipMe cooperará con solicitudes válidas, pero no decide el resultado de una disputa bancaria."] },
      { title: "Reversiones", paragraphs: ["Cuando el proveedor de pagos notifique un reembolso o contracargo, TipMe actualizará el tip y el ledger. El creador puede ser responsable del importe revertido y de las comisiones aplicables; si ya retiró el dinero, su saldo puede quedar negativo y futuros tips se aplicarán primero a esa deuda."] },
      { title: "Derechos obligatorios", paragraphs: ["Esta política no elimina derechos que la legislación aplicable no permita renunciar."] },
    ],
  },
  privacy: {
    title: "Política de privacidad",
    summary: "Qué información utiliza TipMe y para qué.",
    sections: [
      { title: "Datos tratados", paragraphs: ["De creadores podemos tratar datos de cuenta, perfil, categoría de contenido, red social pública, aceptación de las reglas del creador, estado de revisión, preferencias, identificadores del proveedor de pagos y suscripciones push. De fans tratamos el nombre y mensaje solo si deciden proporcionarlos, además del importe, estado del tip y constancia de aceptación legal."] },
      { title: "Datos de pago", paragraphs: ["TipMe no recibe números completos de tarjeta, CVV, contraseñas bancarias ni credenciales del proveedor de pagos. Esos datos son tratados por el proveedor de pagos."] },
      { title: "Finalidades", paragraphs: ["Usamos la información para crear y confirmar tips, mantener el ledger, prevenir fraude, enviar notificaciones, atender soporte y cumplir obligaciones legales."] },
      { title: "Proveedores", paragraphs: ["Utilizamos servicios de infraestructura, alojamiento y proveedores de pago para operar la plataforma. Pueden tratar datos en otros países conforme a sus contratos y políticas."] },
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
      { title: "1. What TipMe is", paragraphs: ["TipMe is a technology tool that lets identified creators receive voluntary financial support from their audience through a dedicated page. The active payment provider processes each transaction under its terms. TipMe is not a bank, does not offer deposit accounts, and does not let users send money to arbitrary recipients."] },
      { title: "2. Nature of tips", paragraphs: ["A tip is voluntary support that thanks a creator for permitted content they already shared on external platforms. It does not purchase or guarantee additional content, messages, attention, access, products, services, benefits, results, or any future obligation from the creator. The fan must verify the public profile and amount before confirming."] },
      { title: "3. Payments, balance, and fees", paragraphs: ["The active payment provider processes charges under its own terms. TipMe does not offer fans stored balances, top-ups, virtual currencies, or peer-to-peer transfers. The balance shown to a creator is a record derived from confirmed payments. TipMe discloses its platform fee before payment; the provider may deduct its own fees and determine availability or withdrawals."] },
      { title: "4. Refunds and disputes", paragraphs: ["Confirmed tips cannot be cancelled automatically through TipMe. This does not limit mandatory rights involving fraud, error, or unauthorized transactions. The payment provider, a bank, or a card issuer may investigate, hold, or reverse a transaction. A refund or chargeback is debited from the creator ledger and may create a negative balance after withdrawal."] },
      { title: "5. Responsibilities and prohibited uses", paragraphs: ["Creators are responsible for the authenticity of their profile and public social account, their taxes, and compliance with payment-provider rules. TipMe may not be used for peer-to-peer transfers, remittances, fraud, impersonation, money laundering, adult content or services, the sale or unlocking of content, paid private interactions, or other illegal or restricted activities."] },
      { title: "6. Availability and suspension", paragraphs: ["We may limit or suspend an account to protect users, investigate abuse, comply with law, or follow payment-provider instructions. We do not guarantee uninterrupted operation of external services."] },
      { title: "7. Changes and applicable law", paragraphs: ["The version accepted is recorded with each tip. Future changes do not retroactively replace that version. Mandatory laws applicable to the user and the TipMe operator continue to apply."] },
    ],
  },
  refunds: {
    title: "Refund Policy",
    summary: "Confirmed tips are voluntary and generally non-refundable.",
    sections: [
      { title: "Voluntary and non-refundable support", paragraphs: ["Tips made through TipMe are voluntary contributions. Once confirmed, they are non-refundable except where required for fraud, technical error, unauthorized transactions, chargebacks, or applicable law."] },
      { title: "Exceptional requests", paragraphs: ["A fan may request help using the transaction code. When a refund applies, it must be processed against the original payment through the provider. It must never be sent through an external transfer or to a different payment method."] },
      { title: "Fraud or unauthorized transaction", paragraphs: ["If a fan does not recognize a transaction, they should immediately contact the payment provider shown on their receipt or their card issuer. TipMe will cooperate with valid requests but does not decide bank disputes."] },
      { title: "Reversals", paragraphs: ["When the payment provider reports a refund or chargeback, TipMe updates the tip and ledger. The creator may be responsible for the reversed amount and applicable fees; after withdrawal this can create a negative balance, and future tips are first applied to that debt."] },
      { title: "Mandatory rights", paragraphs: ["This policy does not remove rights that cannot be waived under applicable law."] },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    summary: "What information TipMe uses and why.",
    sections: [
      { title: "Data processed", paragraphs: ["For creators, we may process account, profile, content category, public social link, creator-rule acceptance, review status, preference, payment-provider identifier, and push-subscription data. For fans, we process a name and message only when voluntarily provided, together with tip amount, status, and legal acceptance record."] },
      { title: "Payment data", paragraphs: ["TipMe does not receive full card numbers, CVVs, bank passwords, or payment-provider credentials. The payment provider processes that information."] },
      { title: "Purposes", paragraphs: ["We use information to create and confirm tips, maintain the ledger, prevent fraud, deliver notifications, provide support, and comply with legal obligations."] },
      { title: "Providers", paragraphs: ["We use infrastructure, hosting, and payment providers to operate the platform. They may process data in other countries under their contracts and policies."] },
      { title: "Retention and security", paragraphs: ["We retain financial and security records as needed to operate, resolve disputes, and comply with law. We use access controls, server-side validation, and secret separation."] },
      { title: "Rights", paragraphs: ["You may request access, correction, or deletion where applicable. Some financial records cannot be deleted immediately because of legal, fraud-prevention, or claims-defense requirements."] },
    ],
  },
};

export function getLegalDocuments(locale: Locale) {
  return locale === "en" ? en : es;
}
