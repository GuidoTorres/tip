import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  tips: [] as Array<{
    id: string;
    payer_name: string;
    message: string | null;
    anonymous: boolean;
    amount_minor: number;
    net_amount_minor: number;
    currency: "USD";
    status: "confirmed";
    created_at: string;
  }>,
  paymentAccount: null as null | {
    status: string;
    payments_receivable: boolean;
    email_confirmed: boolean;
    onboarding_completed: boolean;
  },
  totals: {
    currency: "USD" as const,
    gross_confirmed_minor: 8000,
    platform_fees_minor: 240,
    gateway_fees_minor: 404,
    net_confirmed_minor: 7356,
  },
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/env/public", () => ({
  getPublicEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://tipme.pro" }),
}));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({ PAYMENT_PROVIDER: "paypal", PAYPAL_SANDBOX_SINGLE_MERCHANT: false }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "creator-1" } } }) },
    rpc: async (name: string) => ({ data: name === "creator_tip_totals" ? [state.totals] : [] }),
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        gte: async () => ({ data: state.tips }),
        single: async () => ({ data: { public_name: "Camila", username: "camila" } }),
        maybeSingle: async () => ({ data: state.paymentAccount }),
        limit: async (count: number) => ({ data: table === "tips" ? state.tips.slice(0, count) : null }),
      };
      return query;
    },
  }),
}));

import DashboardPage from "@/app/dashboard/page";

describe("Dashboard PayPal connection status", () => {
  beforeEach(() => {
    state.tips = Array.from({ length: 7 }, (_, index) => ({
      id: `tip-${index + 1}`,
      payer_name: `Fan ${index + 1}`,
      message: null,
      anonymous: false,
      amount_minor: (index + 1) * 100,
      net_amount_minor: (index + 1) * 97,
      currency: "USD" as const,
      status: "confirmed" as const,
      created_at: new Date(Date.now() - index * 60_000).toISOString(),
    }));
    state.paymentAccount = {
      status: "connected",
      payments_receivable: true,
      email_confirmed: true,
      onboarding_completed: true,
    };
  });

  it("shows a verified PayPal badge when the stored account is fully connected", async () => {
    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("PayPal enlazado");
    expect(html).toContain('aria-label="PayPal enlazado"');
  });

  it("does not claim PayPal is linked when there is no verified account", async () => {
    state.paymentAccount = null;

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).not.toContain("PayPal enlazado");
  });

  it("places recent tips after the compact balance", async () => {
    const html = renderToStaticMarkup(await DashboardPage());

    expect(html.indexOf("PayPal recibe")).toBeLessThan(html.indexOf("Últimos tips"));
  });

  it("shows gross, fees and net confirmed totals without abandoned pending orders", async () => {
    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("Total confirmado");
    expect(html).toContain("Comisiones descontadas");
    expect(html).toContain("Total neto");
    expect(html).not.toContain("Pendiente");
    expect(html).not.toContain("Este mes");
  });

  it("shows the six latest tips in two separate desktop cards and links to the full history", async () => {
    const html = renderToStaticMarkup(await DashboardPage());
    const leftColumn = html.indexOf('aria-label="Tips recientes, columna izquierda"');
    const rightColumn = html.indexOf('aria-label="Tips recientes, columna derecha"');
    const leftCard = html.slice(leftColumn, rightColumn);
    const rightCard = html.slice(rightColumn);

    expect(html).toContain("Fan 6");
    expect(html).not.toContain("Fan 7");
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain('aria-label="Últimos cinco tips"');
    expect(leftColumn).toBeGreaterThan(-1);
    expect(rightColumn).toBeGreaterThan(leftColumn);
    expect(leftCard).toContain("Fan 1");
    expect(leftCard).toContain("Fan 3");
    expect(leftCard).not.toContain("Fan 4");
    expect(leftCard.match(/data-tip-card/g)).toHaveLength(3);
    expect(rightCard).toContain("Fan 4");
    expect(rightCard).toContain("Fan 6");
    expect(rightCard.match(/data-tip-card/g)).toHaveLength(3);
    expect(html).toContain('href="/dashboard/tips"');
    expect(html).toContain("Ver todos");
  });

  it("keeps today's gross total based on every confirmed tip even when home lists only six", async () => {
    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("28,00 US$");
  });

  it("places sharing beside the confirmed total and removes the duplicate PayPal action", async () => {
    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).not.toContain("VER EN PAYPAL");
    expect(html.indexOf("Total confirmado")).toBeLessThan(html.indexOf("tipme.pro/camila"));
    expect(html.indexOf("tipme.pro/camila")).toBeLessThan(html.indexOf("PayPal recibe"));
  });
});
