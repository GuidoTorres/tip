import type { Currency } from "./types";

export const mercadoPagoCountries = ["MX", "CO"] as const;
export type MercadoPagoCountry = (typeof mercadoPagoCountries)[number];

export type MercadoPagoRegionEnv = {
  MERCADOPAGO_MX_CLIENT_ID: string;
  MERCADOPAGO_MX_CLIENT_SECRET: string;
  NEXT_PUBLIC_MERCADOPAGO_MX_PUBLIC_KEY: string;
  MERCADOPAGO_MX_WEBHOOK_SECRET: string;
  MERCADOPAGO_CO_CLIENT_ID: string;
  MERCADOPAGO_CO_CLIENT_SECRET: string;
  NEXT_PUBLIC_MERCADOPAGO_CO_PUBLIC_KEY: string;
  MERCADOPAGO_CO_WEBHOOK_SECRET: string;
};

export type MercadoPagoRegion = {
  country: MercadoPagoCountry;
  currency: Extract<Currency, "MXN" | "COP">;
  authBaseUrl: string;
  clientId: string;
  clientSecret: string;
  publicKey: string;
  webhookSecret: string;
};

export function isMercadoPagoCountry(value: string): value is MercadoPagoCountry {
  return mercadoPagoCountries.includes(value as MercadoPagoCountry);
}

export function isMercadoPagoRegionConfigured(region: MercadoPagoRegion) {
  return [region.clientId, region.clientSecret, region.publicKey, region.webhookSecret]
    .every((value) => value.length > 0 && !value.startsWith("fake-"));
}

export function getMercadoPagoRegion(country: string, env: MercadoPagoRegionEnv): MercadoPagoRegion {
  if (country === "MX") {
    return {
      country,
      currency: "MXN",
      authBaseUrl: "https://auth.mercadopago.com.mx",
      clientId: env.MERCADOPAGO_MX_CLIENT_ID,
      clientSecret: env.MERCADOPAGO_MX_CLIENT_SECRET,
      publicKey: env.NEXT_PUBLIC_MERCADOPAGO_MX_PUBLIC_KEY,
      webhookSecret: env.MERCADOPAGO_MX_WEBHOOK_SECRET,
    };
  }
  if (country === "CO") {
    return {
      country,
      currency: "COP",
      authBaseUrl: "https://auth.mercadopago.com.co",
      clientId: env.MERCADOPAGO_CO_CLIENT_ID,
      clientSecret: env.MERCADOPAGO_CO_CLIENT_SECRET,
      publicKey: env.NEXT_PUBLIC_MERCADOPAGO_CO_PUBLIC_KEY,
      webhookSecret: env.MERCADOPAGO_CO_WEBHOOK_SECRET,
    };
  }
  throw new Error("mercadopago_country_unsupported");
}
