import { describe, expect, it } from "vitest";
import { getMercadoPagoRegion, isMercadoPagoCountry, isMercadoPagoRegionConfigured } from "@/features/payments/mercadopago-regions";

const env = {
  MERCADOPAGO_MX_CLIENT_ID: "mx-client",
  MERCADOPAGO_MX_CLIENT_SECRET: "mx-secret",
  NEXT_PUBLIC_MERCADOPAGO_MX_PUBLIC_KEY: "mx-public",
  MERCADOPAGO_MX_WEBHOOK_SECRET: "mx-webhook",
  MERCADOPAGO_CO_CLIENT_ID: "co-client",
  MERCADOPAGO_CO_CLIENT_SECRET: "co-secret",
  NEXT_PUBLIC_MERCADOPAGO_CO_PUBLIC_KEY: "co-public",
  MERCADOPAGO_CO_WEBHOOK_SECRET: "co-webhook",
};

describe("Mercado Pago regional configuration", () => {
  it("maps Mexico to its local credentials and MXN", () => {
    expect(getMercadoPagoRegion("MX", env)).toEqual({
      country: "MX",
      currency: "MXN",
      authBaseUrl: "https://auth.mercadopago.com.mx",
      clientId: "mx-client",
      clientSecret: "mx-secret",
      publicKey: "mx-public",
      webhookSecret: "mx-webhook",
    });
  });

  it("maps Colombia to its local credentials and COP", () => {
    expect(getMercadoPagoRegion("CO", env)).toEqual(expect.objectContaining({
      country: "CO",
      currency: "COP",
      authBaseUrl: "https://auth.mercadopago.com.co",
      clientId: "co-client",
    }));
  });

  it("rejects unsupported countries", () => {
    expect(isMercadoPagoCountry("PE")).toBe(false);
    expect(() => getMercadoPagoRegion("PE", env)).toThrow("mercadopago_country_unsupported");
  });

  it("does not treat placeholder credentials as a configured region", () => {
    expect(isMercadoPagoRegionConfigured(getMercadoPagoRegion("MX", env))).toBe(true);
    expect(isMercadoPagoRegionConfigured(getMercadoPagoRegion("CO", { ...env, MERCADOPAGO_CO_CLIENT_ID: "fake-mp-co-client-id-replace-me" }))).toBe(false);
  });
});
