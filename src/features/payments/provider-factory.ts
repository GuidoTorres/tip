import { MockPaymentProvider } from "./mock-provider";
import type { PaymentProvider } from "./provider";

type ProviderConfig = {
  provider: "mock" | "nuvei" | "ebanx" | "dlocal";
  mockWebhookSecret: string;
};

export function getPaymentProvider(config: ProviderConfig): PaymentProvider {
  if (config.provider === "mock") return new MockPaymentProvider(config.mockWebhookSecret);
  throw new Error(`Payment provider ${config.provider} is not implemented`);
}

