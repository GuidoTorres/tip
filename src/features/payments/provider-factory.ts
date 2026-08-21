import { MockPaymentProvider } from "./mock-provider";
import { PayPalClient, type PayPalConfig } from "./paypal-client";
import { PayPalPaymentProvider } from "./paypal-provider";
import type { PaymentProvider } from "./provider";
import type { ServerEnv } from "@/lib/env/server";
import { payPalConfigFromEnv } from "./paypal-client";
import { MercadoPagoPaymentProvider } from "./mercadopago-provider";

type ProviderConfig = {
  provider: "mock" | "paypal" | "mercadopago" | "nuvei" | "ebanx" | "dlocal";
  mockWebhookSecret: string;
  paypal?: PayPalConfig;
  fetchImpl?: typeof fetch;
  appUrl?: string;
};

export function getPaymentProvider(config: ProviderConfig): PaymentProvider {
  if (config.provider === "mock") return new MockPaymentProvider(config.mockWebhookSecret);
  if (config.provider === "paypal") {
    if (!config.paypal) throw new Error("paypal_config_missing");
    return new PayPalPaymentProvider(new PayPalClient(config.paypal, config.fetchImpl), config.paypal);
  }
  if (config.provider === "mercadopago") {
    if (!config.appUrl) throw new Error("mercadopago_config_missing");
    return new MercadoPagoPaymentProvider({ appUrl: config.appUrl, fetchImpl: config.fetchImpl });
  }
  throw new Error(`Payment provider ${config.provider} is not implemented`);
}

export function getPaymentProviderFromEnv(env: ServerEnv): PaymentProvider {
  return getPaymentProvider({
    provider: env.PAYMENT_PROVIDER,
    mockWebhookSecret: env.MOCK_WEBHOOK_SECRET,
    ...(env.PAYMENT_PROVIDER === "paypal" ? { paypal: payPalConfigFromEnv(env) } : {}),
    ...(env.PAYMENT_PROVIDER === "mercadopago" ? { appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000" } : {}),
  });
}
