import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  profileUpdate: null as Record<string, unknown> | null,
  redirectTo: null as string | null,
}));

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    state.redirectTo = destination;
    throw new Error(`NEXT_REDIRECT:${destination}`);
  },
}));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({ PAYMENT_PROVIDER: "paypal", PAYPAL_FLOW: "platform_payouts" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "creator-1" } } }) },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://example.com/avatar.png" } }),
      }),
    },
    from: () => ({
      update: (values: Record<string, unknown>) => {
        state.profileUpdate = values;
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

import { saveOnboardingProfile } from "@/features/profiles/actions";

describe("PayPal onboarding profile action", () => {
  beforeEach(() => {
    state.profileUpdate = null;
    state.redirectTo = null;
  });

  it("completes onboarding and opens the dashboard after creating the public page", async () => {
    const formData = new FormData();
    formData.set("publicName", "Camila");
    formData.set("username", "camila");
    formData.set("bio", "");
    formData.set("socialUrl", "https://www.tiktok.com/@camila");
    formData.set("contentCategory", "livestreaming");
    formData.set("creatorPolicyAccepted", "on");
    formData.set("locale", "es");

    await expect(saveOnboardingProfile(formData)).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(state.profileUpdate).toMatchObject({
      public_name: "Camila",
      username: "camila",
      social_url: "https://www.tiktok.com/@camila",
      content_category: "livestreaming",
      creator_policy_version: "2026-09-07",
      creator_policy_accepted_at: expect.any(String),
      onboarding_completed: true,
    });
    expect(state.redirectTo).toBe("/dashboard");
  });
});
