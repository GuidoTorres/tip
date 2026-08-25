import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  allowed: true,
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: () => mocks.allowed }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
  }),
}));

import { GET } from "@/app/api/usernames/availability/route";

describe("username availability route", () => {
  beforeEach(() => {
    mocks.allowed = true;
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "creator-1" } } });
    mocks.maybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
  });

  it("reports an unused username as available", async () => {
    const response = await GET(new Request("https://tipme.pro/api/usernames/availability?username=camila"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ username: "camila", available: true });
  });

  it("reports another creator's username as unavailable", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "creator-2" }, error: null });

    const response = await GET(new Request("https://tipme.pro/api/usernames/availability?username=camila"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ username: "camila", available: false });
  });

  it("allows the creator to keep their current username", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "creator-1" }, error: null });

    const response = await GET(new Request("https://tipme.pro/api/usernames/availability?username=camila"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ username: "camila", available: true });
  });

  it("rejects invalid usernames before querying the database", async () => {
    const response = await GET(new Request("https://tipme.pro/api/usernames/availability?username=admin"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "reserved_username" });
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
  });

  it("requires an authenticated creator", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const response = await GET(new Request("https://tipme.pro/api/usernames/availability?username=camila"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "authentication_required" });
  });
});
