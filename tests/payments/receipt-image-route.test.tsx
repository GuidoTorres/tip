import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReceiptToken } from "@/lib/security/receipt";

const secret = "receipt-image-secret-at-least-16";
const state = vi.hoisted(() => ({
  tip: null as null | {
    id: string;
    status: string;
    operation_code: string;
    base_amount_minor: number;
    amount_minor: number;
    currency: string;
    message: string | null;
    profiles: { public_name: string; username: string };
  },
}));

vi.mock("@/lib/env/server", () => ({ getServerEnv: () => ({ RECEIPT_SIGNING_SECRET: "receipt-image-secret-at-least-16" }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: state.tip }),
      };
      return query;
    },
  }),
}));

import { GET } from "@/app/api/tips/[tipId]/receipt-image/route";

describe("confirmed receipt image", () => {
  beforeEach(() => {
    state.tip = {
      id: "tip-1",
      status: "confirmed",
      operation_code: "TM-7A4F-91C2-D8B0-1234",
      base_amount_minor: 2000,
      amount_minor: 2000,
      currency: "USD",
      message: "Para ti",
      profiles: { public_name: "Camila", username: "camila" },
    };
  });

  it("rejects an invalid receipt token", async () => {
    const response = await GET(new Request("https://tipme.pro/api/tips/tip-1/receipt-image?token=bad"), { params: Promise.resolve({ tipId: "tip-1" }) });

    expect(response.status).toBe(404);
  });

  it("does not generate a shareable receipt for an unconfirmed payment", async () => {
    if (state.tip) state.tip.status = "pending";
    const token = createReceiptToken("tip-1", secret);
    const response = await GET(new Request(`https://tipme.pro/api/tips/tip-1/receipt-image?token=${token}`), { params: Promise.resolve({ tipId: "tip-1" }) });

    expect(response.status).toBe(404);
  });

  // Generar el PNG supera el timeout de 5s por defecto cuando la suite corre en paralelo.
  it("returns a protected PNG for a confirmed payment", async () => {
    const token = createReceiptToken("tip-1", secret);
    const response = await GET(new Request(`https://tipme.pro/api/tips/tip-1/receipt-image?token=${token}`), { params: Promise.resolve({ tipId: "tip-1" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(100);
  }, 20_000);
});
