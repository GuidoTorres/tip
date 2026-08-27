export type PayPalFlow = "platform_payouts" | "multiparty";

export type PayPalConfig = {
  environment: "sandbox" | "live";
  sdkVersion: "v5" | "v6";
  merchantCountry: string;
  clientId: string;
  clientSecret: string;
  webhookId: string;
  partnerMerchantId: string;
  partnerAttributionId: string;
  singleMerchantSandbox: boolean;
  flow: PayPalFlow;
};

export function payPalConfigFromEnv(env: {
  PAYPAL_ENVIRONMENT: "sandbox" | "live";
  PAYPAL_JS_SDK_VERSION: "v5" | "v6";
  PAYPAL_MERCHANT_COUNTRY: string;
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_WEBHOOK_ID: string;
  PAYPAL_PARTNER_MERCHANT_ID: string;
  PAYPAL_PARTNER_ATTRIBUTION_ID: string;
  PAYPAL_SANDBOX_SINGLE_MERCHANT: boolean;
  PAYPAL_FLOW: PayPalFlow;
}): PayPalConfig {
  return {
    environment: env.PAYPAL_ENVIRONMENT,
    sdkVersion: env.PAYPAL_JS_SDK_VERSION,
    merchantCountry: env.PAYPAL_MERCHANT_COUNTRY,
    clientId: env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
    webhookId: env.PAYPAL_WEBHOOK_ID,
    partnerMerchantId: env.PAYPAL_PARTNER_MERCHANT_ID,
    partnerAttributionId: env.PAYPAL_PARTNER_ATTRIBUTION_ID,
    singleMerchantSandbox: env.PAYPAL_SANDBOX_SINGLE_MERCHANT,
    flow: env.PAYPAL_FLOW,
  };
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  merchantId?: string;
  idempotencyKey?: string;
};

type CreateOrderInput = {
  tipId: string;
  amountMinor: number;
  platformFeeMinor: number;
  merchantId: string | null;
  idempotencyKey: string;
};

export class PayPalApiError extends Error {
  readonly retryable: boolean;

  constructor(readonly status: number) {
    super("paypal_api_failed");
    this.retryable = status === 408 || status === 429 || status >= 500;
  }
}

function base64Url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function createPayPalAuthAssertion(clientId: string, merchantId: string) {
  return `${base64Url({ alg: "none" })}.${base64Url({ iss: clientId, payer_id: merchantId })}.`;
}

function usd(minor: number) {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error("invalid_money");
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

export class PayPalClient {
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: PayPalConfig, private readonly fetchImpl: typeof fetch = fetch) {}

  private get baseUrl() {
    return this.config.environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  }

  private async token() {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) return this.accessToken.value;
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    const response = await this.fetchImpl(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (!response.ok) throw new PayPalApiError(response.status);
    const data = await response.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new PayPalApiError(502);
    this.accessToken = { value: data.access_token, expiresAt: Date.now() + Math.max(60, data.expires_in ?? 300) * 1_000 };
    return data.access_token;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers({ Authorization: `Bearer ${await this.token()}`, "content-type": "application/json" });
    if (this.config.flow === "multiparty" && !this.config.singleMerchantSandbox && this.config.partnerAttributionId) headers.set("PayPal-Partner-Attribution-Id", this.config.partnerAttributionId);
    if (options.merchantId) headers.set("PayPal-Auth-Assertion", createPayPalAuthAssertion(this.config.clientId, options.merchantId));
    if (options.idempotencyKey) headers.set("PayPal-Request-Id", options.idempotencyKey);
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    if (!response.ok) throw new PayPalApiError(response.status);
    return response.json() as Promise<T>;
  }

  async generateClientToken() {
    const result = await this.request<{ client_token?: string }>("/v1/identity/generate-token", { method: "POST", body: {} });
    if (!result.client_token) throw new PayPalApiError(502);
    return result.client_token;
  }

  async generateBrowserSafeClientToken() {
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    const response = await this.fetchImpl(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials&response_type=client_token&intent=sdk_init",
    });
    if (!response.ok) throw new PayPalApiError(response.status);
    const data = await response.json() as { access_token?: string };
    if (!data.access_token) throw new PayPalApiError(502);
    return data.access_token;
  }

  async createOrder(input: CreateOrderInput) {
    const applicationContext = {
      shipping_preference: "NO_SHIPPING" as const,
      user_action: "PAY_NOW" as const,
      landing_page: "BILLING" as const,
    };
    const purchaseUnit = {
      reference_id: input.tipId,
      custom_id: input.tipId,
      description: "Voluntary support on TipMe",
      amount: { currency_code: "USD" as const, value: usd(input.amountMinor) },
    };
    if (this.config.flow === "platform_payouts" || this.config.singleMerchantSandbox) {
      return this.request<{ id: string; status: string; links?: Array<{ rel?: string; href?: string }> }>("/v2/checkout/orders", {
        method: "POST", idempotencyKey: input.idempotencyKey,
        body: { intent: "CAPTURE", application_context: applicationContext, purchase_units: [purchaseUnit] },
      });
    }
    if (!input.merchantId) throw new Error("paypal_account_not_connected");
    const paymentInstruction: { disbursement_mode: "INSTANT"; platform_fees?: Array<{ amount: { currency_code: "USD"; value: string } }> } = { disbursement_mode: "INSTANT" };
    if (input.platformFeeMinor > 0) paymentInstruction.platform_fees = [{ amount: { currency_code: "USD", value: usd(input.platformFeeMinor) } }];
    return this.request<{ id: string; status: string; links?: Array<{ rel?: string; href?: string }> }>("/v2/checkout/orders", {
      method: "POST",
      merchantId: input.merchantId,
      idempotencyKey: input.idempotencyKey,
      body: {
        intent: "CAPTURE",
        application_context: applicationContext,
        purchase_units: [{
          ...purchaseUnit,
          payee: { merchant_id: input.merchantId },
          payment_instruction: paymentInstruction,
        }],
      },
    });
  }

  async captureOrder(orderId: string, merchantId: string | null, idempotencyKey: string) {
    return this.request<Record<string, unknown>>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST", body: {}, ...(this.config.flow === "multiparty" && !this.config.singleMerchantSandbox && merchantId ? { merchantId } : {}), idempotencyKey,
    });
  }

  async getCapture(captureId: string) {
    return this.request<{
      id?: string;
      seller_receivable_breakdown?: { paypal_fee?: { currency_code: string; value: string } };
    }>(`/v2/payments/captures/${encodeURIComponent(captureId)}`);
  }

  async createPayoutBatch(input: {
    payoutId: string;
    recipientAmountMinor: number;
    currency: "USD";
    receiver: string;
    recipientType: "EMAIL" | "PAYPAL_ID";
    idempotencyKey: string;
  }) {
    return this.request<{ batch_header?: { payout_batch_id?: string; batch_status?: string } }>("/v1/payments/payouts", {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: {
        sender_batch_header: { sender_batch_id: `tipme:${input.payoutId}` },
        items: [{
          sender_item_id: input.payoutId,
          recipient_type: input.recipientType,
          recipient_wallet: "PAYPAL",
          receiver: input.receiver,
          amount: { currency: input.currency, value: usd(input.recipientAmountMinor) },
        }],
      },
    });
  }

  async getPayoutBatch(batchId: string) {
    return this.request<{ batch_header?: { payout_batch_id?: string; batch_status?: string } }>(`/v1/payments/payouts/${encodeURIComponent(batchId)}`);
  }

  async getPayoutItem(itemId: string) {
    return this.request<Record<string, unknown>>(`/v1/payments/payouts-item/${encodeURIComponent(itemId)}`);
  }

  async cancelUnclaimedPayoutItem(itemId: string) {
    return this.request<Record<string, unknown>>(`/v1/payments/payouts-item/${encodeURIComponent(itemId)}/cancel`, { method: "POST", body: {} });
  }

  async verifyWebhook(rawBody: string, headers: Headers) {
    const required = {
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
    };
    if (Object.values(required).some((value) => !value)) return false;
    let webhookEvent: unknown;
    try { webhookEvent = JSON.parse(rawBody); } catch { return false; }
    const result = await this.request<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: { ...required, webhook_id: this.config.webhookId, webhook_event: webhookEvent },
    });
    return result.verification_status === "SUCCESS";
  }

  async createPartnerReferral(payload: unknown) {
    return this.request<{ links?: Array<{ href: string; rel: string }> }>("/v2/customer/partner-referrals", { method: "POST", body: payload });
  }

  async getMerchantIntegration(merchantId: string) {
    return this.request<PayPalMerchantIntegration>(`/v1/customer/partners/${encodeURIComponent(this.config.partnerMerchantId)}/merchant-integrations/${encodeURIComponent(merchantId)}`);
  }

  async getMerchantIntegrationByTrackingId(trackingId: string) {
    try {
      return await this.request<PayPalMerchantIntegration>(`/v1/customer/partners/${encodeURIComponent(this.config.partnerMerchantId)}/merchant-integrations?tracking_id=${encodeURIComponent(trackingId)}`);
    } catch (error) {
      if (error instanceof PayPalApiError && error.status === 404) return {};
      throw error;
    }
  }
}
import type { PayPalMerchantIntegration } from "./paypal-onboarding";
