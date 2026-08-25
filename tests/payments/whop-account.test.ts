import { describe, expect, it, vi } from "vitest";
import { verifyWhopCompany } from "@/features/payments/whop-account";

describe("verifyWhopCompany", () => {
  it("accepts an installed company visible to the TipMe app", async () => {
    const retrieve = vi.fn().mockResolvedValue({ id: "biz_creator123", title: "Creator", verified: true });
    await expect(verifyWhopCompany(" biz_creator123 ", { companies: { retrieve } })).resolves.toEqual({ id: "biz_creator123", title: "Creator", verified: true });
    expect(retrieve).toHaveBeenCalledWith({ id: "biz_creator123" });
  });

  it.each(["", "creator123", "biz_", "biz_<>bad"])("rejects invalid company id %s", async (companyId) => {
    await expect(verifyWhopCompany(companyId, { companies: { retrieve: vi.fn() } })).rejects.toThrow("whop_company_invalid");
  });

  it("does not connect a company the app cannot read", async () => {
    const retrieve = vi.fn().mockRejectedValue(new Error("forbidden"));
    await expect(verifyWhopCompany("biz_creator123", { companies: { retrieve } })).rejects.toThrow("whop_app_not_installed");
  });
});
