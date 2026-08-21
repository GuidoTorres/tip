import type { Currency } from "./types";

export function currencyFractionDigits(currency: Currency) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function convertUsdMinorToLocalMinor(usdMinor: number, rate: number, currency: Currency) {
  if (!Number.isSafeInteger(usdMinor) || usdMinor <= 0 || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("mercadopago_exchange_rate_invalid");
  }
  const result = Math.round((usdMinor / 100) * rate * 10 ** currencyFractionDigits(currency));
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error("mercadopago_exchange_rate_invalid");
  return result;
}

export async function getMercadoPagoExchangeRate(input: {
  accessToken: string;
  from: "USD";
  to: Currency;
  fetchImpl?: typeof fetch;
}) {
  const response = await (input.fetchImpl ?? fetch)(
    `https://api.mercadopago.com/v1/exchange_rates?from=${input.from}&to=${encodeURIComponent(input.to)}`,
    { headers: { authorization: `Bearer ${input.accessToken}`, accept: "application/json" }, cache: "no-store" },
  );
  const result = await response.json().catch(() => null) as {
    currency_base?: unknown; currency_quote?: unknown; rate?: unknown; creation_date?: unknown;
  } | null;
  if (!response.ok || result?.currency_base !== input.from || result.currency_quote !== input.to
    || typeof result.rate !== "number" || !Number.isFinite(result.rate) || result.rate <= 0
    || typeof result.creation_date !== "string" || !Number.isFinite(Date.parse(result.creation_date))) {
    throw new Error("mercadopago_exchange_rate_invalid");
  }
  return { rate: result.rate, quotedAt: result.creation_date };
}
