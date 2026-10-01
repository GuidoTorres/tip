import { describe, expect, it } from "vitest";
import { SupabaseTipRepository } from "@/features/payments/supabase-tip-repository";

function clientWithCreator(status?: string, onboarding = true) {
  const row = { id: "creator-1", username: "camila", preferred_currency: "USD", onboarding_completed: onboarding, payment_review_status: status };
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: row, error: null }),
  };
  return {
    from: () => query,
    rpc: () => ({
      maybeSingle: async () => ({
        data: { ...row, can_accept_tips: status === "approved" },
        error: null,
      }),
    }),
  };
}

describe("creator eligibility without manual approval", () => {
  it.each(["rejected", "suspended", "unexpected"])("blocks %s profiles", async (status) => {
    const repository = new SupabaseTipRepository(clientWithCreator(status) as never);
    await expect(repository.findCreatorByUsername("camila")).resolves.toBeNull();
  });

  it.each([undefined, "pending", "approved"])("allows completed profiles with review status %s", async (status) => {
    const repository = new SupabaseTipRepository(clientWithCreator(status) as never);

    await expect(repository.findCreatorByUsername("camila")).resolves.toEqual({ id: "creator-1", currency: "USD" });
  });
  it("blocks incomplete profiles", async () => {
    const repository = new SupabaseTipRepository(clientWithCreator("pending", false) as never);
    await expect(repository.findCreatorByUsername("camila")).resolves.toBeNull();
  });
});
