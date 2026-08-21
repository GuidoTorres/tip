import { describe, expect, it, vi } from "vitest";
import { MercadoPagoPaymentProvider } from "@/features/payments/mercadopago-provider";

describe("MercadoPagoPaymentProvider", () => {
  it("creates a direct seller charge with the TipMe application fee", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 991, status: "approved" }), { status: 201, headers: { "content-type": "application/json" } }));
    const provider = new MercadoPagoPaymentProvider({ appUrl: "https://tipme.pro", fetchImpl });

    const result = await provider.createPayment({
      tipId: "tip-1", amountMinor: 20_000, platformFeeMinor: 200, currency: "MXN",
      providerAccountId: "seller-42", providerAccessToken: "seller-access-token", providerCountry: "MX",
      idempotencyKey: "create:tip-1",
      paymentMethodData: { token: "card-token", paymentMethodId: "visa", issuerId: "123", installments: 1, payer: { email: "fan@example.com" } },
    });

    const [url, options] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.mercadopago.com/v1/payments");
    expect(new Headers(options.headers).get("authorization")).toBe("Bearer seller-access-token");
    expect(new Headers(options.headers).get("x-idempotency-key")).toBe("create:tip-1");
    expect(JSON.parse(String(options.body))).toMatchObject({
      transaction_amount: 200,
      application_fee: 2,
      external_reference: "tip-1",
      token: "card-token",
      payment_method_id: "visa",
      notification_url: "https://tipme.pro/api/webhooks/mercadopago/MX",
    });
    expect(result).toMatchObject({ providerPaymentId: "991", status: "pending" });
  });

  it("fails closed without a seller OAuth token", async () => {
    const provider = new MercadoPagoPaymentProvider({ appUrl: "https://tipme.pro", fetchImpl: vi.fn() });
    await expect(provider.createPayment({ tipId: "tip-1", amountMinor: 2_000, platformFeeMinor: 20, currency: "COP", providerAccountId: "42", idempotencyKey: "key" })).rejects.toThrow("mercadopago_credentials_missing");
  });
});
