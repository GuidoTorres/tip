import type { WhopApi } from "./whop-provider";

const WHOP_COMPANY_ID = /^biz_[A-Za-z0-9_-]{6,64}$/;

export async function verifyWhopCompany(companyIdInput: string, client: Pick<WhopApi, "companies">) {
  const companyId = companyIdInput.trim();
  if (!WHOP_COMPANY_ID.test(companyId)) throw new Error("whop_company_invalid");
  try {
    const company = await client.companies.retrieve({ id: companyId });
    if (company.id !== companyId) throw new Error("whop_company_mismatch");
    return { id: company.id, title: company.title, verified: company.verified };
  } catch (error) {
    if (error instanceof Error && error.message === "whop_company_mismatch") throw error;
    throw new Error("whop_app_not_installed");
  }
}
