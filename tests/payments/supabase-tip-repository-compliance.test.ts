import { describe, expect, it } from "vitest";
import { SupabaseTipRepository } from "@/features/payments/supabase-tip-repository";

function clientWithCreator(canAcceptTips: boolean) {
  return {
    rpc: () => ({
      maybeSingle: async () => ({
        data: { id: "creator-1", preferred_currency: "USD", can_accept_tips: canAcceptTips },
        error: null,
      }),
    }),
  };
}

describe("SupabaseTipRepository compliance gate", () => {
  it("does not return a creator whose policy review is pending", async () => {
    const repository = new SupabaseTipRepository(clientWithCreator(false) as never);

    await expect(repository.findCreatorByUsername("camila")).resolves.toBeNull();
  });

  it("returns an approved creator", async () => {
    const repository = new SupabaseTipRepository(clientWithCreator(true) as never);

    await expect(repository.findCreatorByUsername("camila")).resolves.toEqual({ id: "creator-1", currency: "USD" });
  });
});
