import { describe, expect, it } from "vitest";
import {
  getMercadoPagoCountryOption,
  getMercadoPagoRegion,
  getMercadoPagoSignupUrl,
  isMercadoPagoCountry,
  isMercadoPagoRegionConfigured,
  mercadoPagoCountryOptions,
  mercadoPagoCountries,
} from "@/features/payments/mercadopago-regions";

const env = {
  MERCADOPAGO_AR_CLIENT_ID: "ar-client", MERCADOPAGO_AR_CLIENT_SECRET: "ar-secret",
  NEXT_PUBLIC_MERCADOPAGO_AR_PUBLIC_KEY: "ar-public", MERCADOPAGO_AR_WEBHOOK_SECRET: "ar-webhook",
  MERCADOPAGO_BR_CLIENT_ID: "br-client", MERCADOPAGO_BR_CLIENT_SECRET: "br-secret",
  NEXT_PUBLIC_MERCADOPAGO_BR_PUBLIC_KEY: "br-public", MERCADOPAGO_BR_WEBHOOK_SECRET: "br-webhook",
  MERCADOPAGO_CL_CLIENT_ID: "cl-client", MERCADOPAGO_CL_CLIENT_SECRET: "cl-secret",
  NEXT_PUBLIC_MERCADOPAGO_CL_PUBLIC_KEY: "cl-public", MERCADOPAGO_CL_WEBHOOK_SECRET: "cl-webhook",
  MERCADOPAGO_CO_CLIENT_ID: "co-client", MERCADOPAGO_CO_CLIENT_SECRET: "co-secret",
  NEXT_PUBLIC_MERCADOPAGO_CO_PUBLIC_KEY: "co-public", MERCADOPAGO_CO_WEBHOOK_SECRET: "co-webhook",
  MERCADOPAGO_MX_CLIENT_ID: "mx-client", MERCADOPAGO_MX_CLIENT_SECRET: "mx-secret",
  NEXT_PUBLIC_MERCADOPAGO_MX_PUBLIC_KEY: "mx-public", MERCADOPAGO_MX_WEBHOOK_SECRET: "mx-webhook",
  MERCADOPAGO_PE_CLIENT_ID: "pe-client", MERCADOPAGO_PE_CLIENT_SECRET: "pe-secret",
  NEXT_PUBLIC_MERCADOPAGO_PE_PUBLIC_KEY: "pe-public", MERCADOPAGO_PE_WEBHOOK_SECRET: "pe-webhook",
  MERCADOPAGO_UY_CLIENT_ID: "uy-client", MERCADOPAGO_UY_CLIENT_SECRET: "uy-secret",
  NEXT_PUBLIC_MERCADOPAGO_UY_PUBLIC_KEY: "uy-public", MERCADOPAGO_UY_WEBHOOK_SECRET: "uy-webhook",
};

const expectedRegions = [
  { country: "AR", currency: "ARS", authBaseUrl: "https://auth.mercadopago.com.ar", locale: "es-AR", siteId: "MLA" },
  { country: "BR", currency: "BRL", authBaseUrl: "https://auth.mercadopago.com.br", locale: "pt-BR", siteId: "MLB" },
  { country: "CL", currency: "CLP", authBaseUrl: "https://auth.mercadopago.cl", locale: "es-CL", siteId: "MLC" },
  { country: "CO", currency: "COP", authBaseUrl: "https://auth.mercadopago.com.co", locale: "es-CO", siteId: "MCO" },
  { country: "MX", currency: "MXN", authBaseUrl: "https://auth.mercadopago.com.mx", locale: "es-MX", siteId: "MLM" },
  { country: "PE", currency: "PEN", authBaseUrl: "https://auth.mercadopago.com.pe", locale: "es-PE", siteId: "MPE" },
  { country: "UY", currency: "UYU", authBaseUrl: "https://auth.mercadopago.com.uy", locale: "es-UY", siteId: "MLU" },
] as const;

describe("Mercado Pago regional configuration", () => {
  it("offers every country supported by Split Payments 1:1", () => {
    expect(mercadoPagoCountries).toEqual(["AR", "BR", "CL", "CO", "MX", "PE", "UY"]);
    expect(mercadoPagoCountryOptions).toHaveLength(7);
    for (const expected of expectedRegions) expect(isMercadoPagoCountry(expected.country)).toBe(true);
  });

  it.each(expectedRegions)("maps $country to its currency, OAuth host, locale and site", (expected) => {
    expect(getMercadoPagoCountryOption(expected.country)).toEqual(expect.objectContaining(expected));
    expect(getMercadoPagoRegion(expected.country, env)).toEqual(expect.objectContaining({
      ...expected,
      clientId: `${expected.country.toLowerCase()}-client`,
      clientSecret: `${expected.country.toLowerCase()}-secret`,
      publicKey: `${expected.country.toLowerCase()}-public`,
      webhookSecret: `${expected.country.toLowerCase()}-webhook`,
    }));
  });

  it("rejects unsupported countries", () => {
    expect(isMercadoPagoCountry("US")).toBe(false);
    expect(() => getMercadoPagoRegion("US", env)).toThrow("mercadopago_country_unsupported");
  });

  it("does not treat placeholder credentials as a configured region", () => {
    expect(isMercadoPagoRegionConfigured(getMercadoPagoRegion("PE", env))).toBe(true);
    expect(isMercadoPagoRegionConfigured(getMercadoPagoRegion("PE", { ...env, MERCADOPAGO_PE_CLIENT_ID: "fake-mp-pe-client-id-replace-me" }))).toBe(false);
  });

  it("builds the official registration page for the selected country", () => {
    expect(getMercadoPagoSignupUrl("PE")).toBe("https://www.mercadopago.com.pe/signup/splitter");
    expect(getMercadoPagoSignupUrl("MX")).toBe("https://www.mercadopago.com.mx/signup/splitter");
  });
});
