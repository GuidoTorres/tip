import { describe, expect, it, vi } from "vitest";
import { MercadoPagoPaymentProvider } from "@/features/payments/mercadopago-provider";

describe("MercadoPagoPaymentProvider", () => {
  it("logs only safe Mercado Pago error details when a payment is rejected", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: "Invalid transaction_amount",
      error: "bad_request",
      cause: [{ code: 1004, description: "Transaction amount below minimum" }],
      token: "must-not-be-logged",
    }), { status: 400, headers: { "content-type": "application/json" } }));
    const provider = new MercadoPagoPaymentProvider({ appUrl: "https://tipme.pro", fetchImpl });

    await expect(provider.createPayment({
      tipId: "tip-error", amountMinor: 100, platformFeeMinor: 1, currency: "PEN",
      providerAccountId: "seller-pe", providerAccessToken: "seller-token", providerCountry: "PE",
      idempotencyKey: "key-error",
      paymentMethodData: { token: "card-token", paymentMethodId: "visa", issuerId: null, installments: 1, payer: { email: "fan@example.com" } },
    })).rejects.toThrow("mercadopago_payment_create_failed");

    expect(consoleError).toHaveBeenCalledWith(JSON.stringify({
      event: "mercadopago_payment_create_failed",
      status: 400,
      error: "bad_request",
      message: "Invalid transaction_amount",
      causeCode: "1004",
      causeDescription: "Transaction amount below minimum",
    }));
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("must-not-be-logged");
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("card-token");
    consoleError.mockRestore();
  });

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

  it("creates payments in Peruvian soles", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 992, status: "pending" }), { status: 201 }));
    const provider = new MercadoPagoPaymentProvider({ appUrl: "https://tipme.pro", fetchImpl });

    const result = await provider.createPayment({
      tipId: "tip-pe", amountMinor: 2_000, platformFeeMinor: 20, currency: "PEN",
      providerAccountId: "seller-pe", providerAccessToken: "seller-token", providerCountry: "PE",
      idempotencyKey: "key-pe",
      paymentMethodData: { token: "card-token", paymentMethodId: "visa", issuerId: null, installments: 1, payer: { email: "fan@example.com" } },
    });

    const [, options] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual(expect.objectContaining({
      transaction_amount: 20,
      notification_url: "https://tipme.pro/api/webhooks/mercadopago/PE",
    }));
    expect(result).toMatchObject({ providerPaymentId: "992", status: "pending" });
  });

  it("sends Chilean peso minor units without dividing them as cents", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 993, status: "pending" }), { status: 201 }));
    const provider = new MercadoPagoPaymentProvider({ appUrl: "https://tipme.pro", fetchImpl });

    await provider.createPayment({
      tipId: "tip-cl", amountMinor: 19_008, platformFeeMinor: 190, currency: "CLP",
      providerAccountId: "seller-cl", providerAccessToken: "seller-token", providerCountry: "CL",
      idempotencyKey: "key-cl",
      paymentMethodData: { token: "card-token", paymentMethodId: "visa", installments: 1, payer: { email: "fan@example.com" } },
    });

    const [, options] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toMatchObject({ transaction_amount: 19_008, application_fee: 190 });
  });
});
