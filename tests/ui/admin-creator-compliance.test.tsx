import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/guard", () => ({
  requireAdmin: async () => ({
    user: { id: "admin-1" },
    supabase: {
      from: () => {
        const query = {
          select: () => query,
          eq: () => query,
          order: () => query,
          limit: async () => ({ data: [{
            id: "creator-1",
            public_name: "Camila",
            username: "camila",
            country: "CO",
            preferred_currency: "USD",
            onboarding_completed: true,
            social_url: "https://tiktok.com/@camila",
            content_category: "livestreaming",
            payment_review_status: "pending",
            payment_review_reason: null,
            created_at: "2026-09-07T00:00:00.000Z",
          }] }),
        };
        return query;
      },
    },
  }),
}));

import AdminCreatorsPage from "@/app/admin/creators/page";

describe("admin creator compliance queue", () => {
  it("shows the declared activity and server-reviewed decisions", async () => {
    const html = renderToStaticMarkup(await AdminCreatorsPage());

    expect(html).toContain("livestreaming");
    expect(html).toContain("https://tiktok.com/@camila");
    expect(html).toContain("Pendiente");
    expect(html).toMatch(/<button[^>]+value="approved"[^>]+name="status"/);
    expect(html).toMatch(/<button[^>]+value="rejected"[^>]+name="status"/);
  });
});
