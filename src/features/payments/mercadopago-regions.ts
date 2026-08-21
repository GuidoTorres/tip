import type { Currency } from "./types";

export const mercadoPagoCountries = ["AR", "BR", "CL", "CO", "MX", "PE", "UY"] as const;
export type MercadoPagoCountry = (typeof mercadoPagoCountries)[number];

export const mercadoPagoCountryOptions = [
  { country: "AR", name: "Argentina", currency: "ARS", authBaseUrl: "https://auth.mercadopago.com.ar", locale: "es-AR", siteId: "MLA" },
  { country: "BR", name: "Brasil", currency: "BRL", authBaseUrl: "https://auth.mercadopago.com.br", locale: "pt-BR", siteId: "MLB" },
  { country: "CL", name: "Chile", currency: "CLP", authBaseUrl: "https://auth.mercadopago.cl", locale: "es-CL", siteId: "MLC" },
  { country: "CO", name: "Colombia", currency: "COP", authBaseUrl: "https://auth.mercadopago.com.co", locale: "es-CO", siteId: "MCO" },
  { country: "MX", name: "México", currency: "MXN", authBaseUrl: "https://auth.mercadopago.com.mx", locale: "es-MX", siteId: "MLM" },
  { country: "PE", name: "Perú", currency: "PEN", authBaseUrl: "https://auth.mercadopago.com.pe", locale: "es-PE", siteId: "MPE" },
  { country: "UY", name: "Uruguay", currency: "UYU", authBaseUrl: "https://auth.mercadopago.com.uy", locale: "es-UY", siteId: "MLU" },
] as const satisfies readonly {
  country: MercadoPagoCountry;
  name: string;
  currency: Currency;
  authBaseUrl: string;
  locale: string;
  siteId: string;
}[];

export type MercadoPagoCurrency = (typeof mercadoPagoCountryOptions)[number]["currency"];

export type MercadoPagoRegionEnv = {
  [Country in MercadoPagoCountry as `MERCADOPAGO_${Country}_CLIENT_ID`]: string;
} & {
  [Country in MercadoPagoCountry as `MERCADOPAGO_${Country}_CLIENT_SECRET`]: string;
} & {
  [Country in MercadoPagoCountry as `NEXT_PUBLIC_MERCADOPAGO_${Country}_PUBLIC_KEY`]: string;
} & {
  [Country in MercadoPagoCountry as `MERCADOPAGO_${Country}_WEBHOOK_SECRET`]: string;
};

export type MercadoPagoRegion = (typeof mercadoPagoCountryOptions)[number] & {
  clientId: string;
  clientSecret: string;
  publicKey: string;
  webhookSecret: string;
};

export function isMercadoPagoCountry(value: string): value is MercadoPagoCountry {
  return mercadoPagoCountries.includes(value as MercadoPagoCountry);
}

export function getMercadoPagoCountryOption(country: string) {
  const option = mercadoPagoCountryOptions.find((candidate) => candidate.country === country);
  if (!option) throw new Error("mercadopago_country_unsupported");
  return option;
}

export function getMercadoPagoSignupUrl(country: string) {
  const option = getMercadoPagoCountryOption(country);
  return `${option.authBaseUrl.replace("https://auth.", "https://www.")}/signup/splitter`;
}

export function isMercadoPagoRegionConfigured(region: MercadoPagoRegion) {
  return [region.clientId, region.clientSecret, region.publicKey, region.webhookSecret]
    .every((value) => value.length > 0 && !value.startsWith("fake-"));
}

export function getMercadoPagoRegion(country: string, env: MercadoPagoRegionEnv): MercadoPagoRegion {
  if (!isMercadoPagoCountry(country)) throw new Error("mercadopago_country_unsupported");
  const option = getMercadoPagoCountryOption(country);
  return {
    ...option,
    clientId: env[`MERCADOPAGO_${country}_CLIENT_ID`],
    clientSecret: env[`MERCADOPAGO_${country}_CLIENT_SECRET`],
    publicKey: env[`NEXT_PUBLIC_MERCADOPAGO_${country}_PUBLIC_KEY`],
    webhookSecret: env[`MERCADOPAGO_${country}_WEBHOOK_SECRET`],
  } as MercadoPagoRegion;
}
