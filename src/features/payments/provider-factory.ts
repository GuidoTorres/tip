import { PayPalClient, payPalConfigFromEnv } from "./paypal-client";
import { PayPalPaymentProvider } from "./paypal-provider";
import type { PaymentProvider } from "./provider";
import type { ServerEnv } from "@/lib/env/server";

export function getPaymentProviderFromEnv(env: ServerEnv): PaymentProvider {
  const config = payPalConfigFromEnv(env);
  return new PayPalPaymentProvider(new PayPalClient(config), config);
}
