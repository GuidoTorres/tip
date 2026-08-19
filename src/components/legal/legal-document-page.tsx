import type { LegalDocument } from "@/features/legal/content";
import { CURRENT_LEGAL_TERMS_VERSION } from "@/features/legal/terms";

export function LegalDocumentPage({ document, operatorName, contactEmail, locale }: {
  document: LegalDocument;
  operatorName: string;
  contactEmail: string;
  locale: "es" | "en";
}) {
  return <article><p className="text-sm font-semibold text-accent">TipMe</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">{document.title}</h1><p className="mt-3 leading-relaxed text-muted">{document.summary}</p><p className="mt-3 text-xs text-muted">{locale === "es" ? "Versión" : "Version"}: {CURRENT_LEGAL_TERMS_VERSION}</p><div className="mt-9 space-y-8">{document.sections.map((section) => <section key={section.title}><h2 className="text-xl font-semibold tracking-[-0.03em]">{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-3 leading-relaxed text-muted">{paragraph}</p>)}</section>)}</div><section className="mt-10 rounded-2xl bg-surface-soft p-5"><h2 className="font-semibold">{locale === "es" ? "Operador y contacto" : "Operator and contact"}</h2><p className="mt-2 text-sm text-muted">{operatorName || (locale === "es" ? "Operador de TipMe (se identificará antes de activar pagos reales)." : "TipMe operator (to be identified before live payments are enabled).")}</p>{contactEmail && <a href={`mailto:${contactEmail}`} className="mt-2 inline-block text-sm font-semibold text-accent underline">{contactEmail}</a>}</section></article>;
}
