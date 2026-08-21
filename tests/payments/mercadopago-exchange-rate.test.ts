import { describe, expect, it, vi } from "vitest";
import { convertUsdMinorToLocalMinor, getMercadoPagoExchangeRate } from "@/features/payments/mercadopago-exchange-rate";

describe("Mercado Pago exchange rates", () => {
  it("converts USD cents into the target ISO minor unit", () => {
    expect(convertUsdMinorToLocalMinor(2_000, 3.361, "PEN")).toBe(6_722);
    expect(convertUsdMinorToLocalMinor(2_000, 950.4, "CLP")).toBe(19_008);
  });

  it("accepts only a valid USD-to-local response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      currency_base: "USD", currency_quote: "PEN", rate: 3.361,
      creation_date: "2026-08-21T00:00:00.000+00:00",
    }), { status: 200 }));

    await expect(getMercadoPagoExchangeRate({ accessToken: "seller-token", from: "USD", to: "PEN", fetchImpl }))
      .resolves.toEqual({ rate: 3.361, quotedAt: "2026-08-21T00:00:00.000+00:00" });
  });

  it("fails closed on a malformed provider response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      currency_base: "USD", currency_quote: "PEN", rate: 0,
    }), { status: 200 }));

    await expect(getMercadoPagoExchangeRate({ accessToken: "seller-token", from: "USD", to: "PEN", fetchImpl }))
      .rejects.toThrow("mercadopago_exchange_rate_invalid");
  });
});
