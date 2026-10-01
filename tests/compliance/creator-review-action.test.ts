import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rpc: vi.fn(), revalidated: [] as string[] }));

vi.mock("@/features/admin/guard", () => ({
  requireAdmin: async () => ({ user: { id: "8a05c612-4138-46d1-8f63-607fcde5fc88" } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({ rpc: state.rpc }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => state.revalidated.push(path),
}));

import { reviewCreatorPolicyAction } from "@/features/compliance/actions";

describe("reviewCreatorPolicyAction", () => {
  beforeEach(() => {
    state.rpc.mockReset().mockResolvedValue({ error: null });
    state.revalidated = [];
  });

  it("derives the reviewer from the authenticated admin", async () => {
    const formData = new FormData();
    formData.set("creatorId", "7d9554d4-7e1b-42e5-9d16-f0030ab6008e");
    formData.set("status", "approved");
    formData.set("reason", "Perfil pÃºblico verificado");

    await reviewCreatorPolicyAction(formData);

    expect(state.rpc).toHaveBeenCalledWith("review_creator_policy", {
      requested_creator: "7d9554d4-7e1b-42e5-9d16-f0030ab6008e",
      requested_status: "approved",
      requested_reason: "Perfil pÃºblico verificado",
      requested_admin: "8a05c612-4138-46d1-8f63-607fcde5fc88",
    });
    expect(state.revalidated).toContain("/admin/creators");
    expect(state.revalidated).toContain("/dashboard");
  });
});
