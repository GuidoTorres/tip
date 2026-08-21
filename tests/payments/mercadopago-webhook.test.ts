import { describe, expect, it } from "vitest";
import { mercadoPagoEventFromPayment, validateMercadoPagoPayment } from "@/features/payments/mercadopago-webhook";

const payment = {
  id: 991,
  status: "approved",
  collector_id: 42,
  external_reference: "tip-1",
  currency_id: "MXN",
  transaction_amount: 200,
  application_fee: 2,
  date_last_updated: "2026-08-20T20:00:00.000Z",
  fee_details: [{ type: "mercadopago_fee", amount: 7.2 }, { type: "application_fee", amount: 2 }],
};

describe("Mercado Pago authoritative webhook payment", () => {
  it("validates seller, tip, amount, currency and application fee", () => {
    expect(() => validateMercadoPagoPayment(payment, { paymentId: "991", tipId: "tip-1", merchantId: "42", amountMinor: 20_000, platformFeeMinor: 200, currency: "MXN" })).not.toThrow();
  });

  it("fails closed on financial mismatches", () => {
    expect(() => validateMercadoPagoPayment(payment, { paymentId: "991", tipId: "tip-1", merchantId: "42", amountMinor: 20_001, platformFeeMinor: 200, currency: "MXN" })).toThrow("mercadopago_payment_mismatch");
  });

  it("maps approved and excludes TipMe's fee from the gateway fee", () => {
    expect(mercadoPagoEventFromPayment(payment, "payment.updated")).toMatchObject({ status: "confirmed", providerPaymentId: "991", gatewayFeeMinor: 720 });
  });

  it.each([["pending", "pending"], ["rejected", "rejected"], ["refunded", "refunded"], ["charged_back", "chargeback"]] as const)("maps %s", (status, expected) => {
    expect(mercadoPagoEventFromPayment({ ...payment, status }, "payment.updated").status).toBe(expected);
  });
});
