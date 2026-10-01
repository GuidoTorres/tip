import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rpc: vi.fn(), user: { id: "creator-1" } as { id: string } | null }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/env/server", () => ({ getServerEnv: () => ({ PAYMENT_PROVIDER: "paypal", PAYPAL_FLOW: "platform_payouts" }) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.user } }) }, rpc: state.rpc,
}) }));

import { savePayPalPayoutEmail } from "@/features/profiles/actions";

function form(confirmation?: string, confirmed = true) {
  const data = new FormData();
  data.set("paypalEmail", " Creator@Example.com ");
  data.set("returnTo", "/dashboard/payouts");
  if (confirmation !== undefined) data.set("paypalEmailConfirmation", confirmation);
  if (confirmed) data.set("paypalEmailConfirmed", "on");
  return data;
}

describe("confirming a PayPal withdrawal email", () => {
  beforeEach(() => { state.user = { id: "creator-1" }; state.rpc.mockReset().mockResolvedValue({ error: null }); });
  it.each([undefined, "different@example.com"])("rejects missing or mismatched confirmation: %s", async (confirmation) => {
    await expect(savePayPalPayoutEmail(form(confirmation))).rejects.toThrow("error=confirm_paypal_email");
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("requires explicit acknowledgment", async () => {
    await expect(savePayPalPayoutEmail(form("creator@example.com", false))).rejects.toThrow("error=confirm_paypal_email");
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("saves the normalized email only after confirmation", async () => {
    await expect(savePayPalPayoutEmail(form("CREATOR@example.com"))).rejects.toThrow("success=paypal_saved");
    expect(state.rpc).toHaveBeenCalledWith("set_my_paypal_payout_email", { p_email: "creator@example.com" });
  });
  it("requires a signed-in creator", async () => {
    state.user = null;
    await expect(savePayPalPayoutEmail(form("creator@example.com"))).rejects.toThrow("redirect:/login");
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
