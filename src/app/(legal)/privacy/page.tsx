import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getLegalDocuments } from "@/features/legal/content";
import { getRequestLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Política de privacidad" };

export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  return <LegalDocumentPage document={getLegalDocuments(locale).privacy} operatorName={process.env.LEGAL_OPERATOR_NAME?.trim() ?? ""} contactEmail={process.env.LEGAL_CONTACT_EMAIL?.trim() ?? ""} locale={locale} />;
}
