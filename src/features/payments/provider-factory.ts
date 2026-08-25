import { MockPaymentProvider } from "./mock-provider";
import type { PaymentProvider } from "./provider";
import type { ServerEnv } from "@/lib/env/server";
import { MercadoPagoPaymentProvider } from "./mercadopago-provider";
import { DLocalGoPaymentProvider } from "./dlocalgo-provider";
import { WhopPaymentProvider } from "./whop-provider";

type ProviderConfig = {
  provider: "mock" | "mercadopago" | "dlocalgo" | "whop";
  mockWebhookSecret: string;
  fetchImpl?: typeof fetch;
  appUrl?: string;
  dlocalgo?: { apiKey: string; secretKey: string; environment: "sandbox" | "live" };
  whop?: { apiKey: string; webhookSecret: string; environment: "sandbox" | "live" };
};

export function getPaymentProvider(config: ProviderConfig): PaymentProvider {
  if (config.provider === "mock") return new MockPaymentProvider(config.mockWebhookSecret);
  if (config.provider === "mercadopago") {
    if (!config.appUrl) throw new Error("mercadopago_config_missing");
    return new MercadoPagoPaymentProvider({ appUrl: config.appUrl, fetchImpl: config.fetchImpl });
  }
  if (config.provider === "dlocalgo") {
    if (!config.appUrl || !config.dlocalgo) throw new Error("dlocalgo_config_missing");
    return new DLocalGoPaymentProvider({ ...config.dlocalgo, appUrl: config.appUrl, fetchImpl: config.fetchImpl });
  }
  if (config.provider === "whop") {
    if (!config.appUrl || !config.whop) throw new Error("whop_config_missing");
    return new WhopPaymentProvider({
      apiKey: config.whop.apiKey,
      webhookSecret: config.whop.webhookSecret,
      appUrl: config.appUrl,
      fetchImpl: config.fetchImpl,
    });
  }
  throw new Error(`Payment provider ${config.provider} is not implemented`);
}

export function getPaymentProviderFromEnv(env: ServerEnv): PaymentProvider {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return getPaymentProvider({
    provider: env.PAYMENT_PROVIDER,
    mockWebhookSecret: env.MOCK_WEBHOOK_SECRET,
    ...(env.PAYMENT_PROVIDER === "mercadopago" ? { appUrl } : {}),
    ...(env.PAYMENT_PROVIDER === "dlocalgo" ? {
      appUrl,
      dlocalgo: {
        apiKey: env.DLOCALGO_API_KEY,
        secretKey: env.DLOCALGO_SECRET_KEY,
        environment: env.DLOCALGO_ENVIRONMENT,
      },
    } : {}),
    ...(env.PAYMENT_PROVIDER === "whop" ? {
      appUrl,
      whop: {
        apiKey: env.WHOP_API_KEY,
        webhookSecret: env.WHOP_WEBHOOK_SECRET,
        environment: env.WHOP_ENVIRONMENT,
      },
    } : {}),
  });
}
