import type { Locale } from "@/lib/i18n/config";

type PaymentSessionCallbacks = {
  onApprove: (data: { orderId: string }) => void | Promise<void>;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
};

export type PayPalV6CardSession = {
  createCardFieldsComponent(input: {
    type: "number" | "expiry" | "cvv";
    placeholder?: string;
    style?: Record<string, Record<string, string>>;
  }): HTMLElement;
  submit(orderId: string, options?: Record<string, unknown>): Promise<{ state: "succeeded" | "canceled" | "failed"; data?: { orderId?: string; message?: string } }>;
};

type ApplePayDetails = { config: Record<string, unknown> };

export type PayPalV6Instance = {
  findEligibleMethods(input: { currencyCode: string; amount?: string }): Promise<{
    isEligible(method: "paypal" | "advanced_cards" | "applepay"): boolean;
    getDetails(method: "applepay"): ApplePayDetails | undefined;
  }>;
  createPayPalOneTimePaymentSession(callbacks: PaymentSessionCallbacks): {
    start(options: { presentationMode: "auto" }, order: Promise<{ orderId: string }>): Promise<void>;
  };
  createCardFieldsOneTimePaymentSession(): PayPalV6CardSession;
  createApplePayOneTimePaymentSession(): {
    formatConfigForPaymentRequest(config: Record<string, unknown>): Record<string, unknown>;
    validateMerchant(input: { validationUrl: string }): Promise<{ merchantSession: unknown }>;
    confirmOrder(input: { orderId: string; token: unknown; billingContact?: unknown }): Promise<unknown>;
  };
};

type PayPalV6Namespace = {
  createInstance(input: {
    clientToken: string;
    components: ["paypal-payments", "card-fields", "applepay-payments"];
    pageType: "checkout";
    locale: string;
    merchantId?: string;
    partnerAttributionId?: string;
  }): Promise<PayPalV6Instance>;
};

type ApplePaySessionInstance = {
  onvalidatemerchant: ((event: { validationURL: string }) => void) | null;
  onpaymentauthorized: ((event: { payment: { token: unknown; billingContact?: unknown } }) => void) | null;
  oncancel: (() => void) | null;
  completeMerchantValidation(session: unknown): void;
  completePayment(result: { status: number }): void;
  abort(): void;
  begin(): void;
};

export type ApplePaySessionConstructor = {
  new(version: number, request: Record<string, unknown>): ApplePaySessionInstance;
  STATUS_SUCCESS: number;
  STATUS_FAILURE: number;
  canMakePayments(): boolean;
};

let activeEnvironment: "sandbox" | "live" | null = null;
let loading: Promise<PayPalV6Namespace> | null = null;
let applePayLoading: Promise<void> | null = null;

export function buildPayPalV6SdkScript(environment: "sandbox" | "live") {
  return environment === "live"
    ? "https://www.paypal.com/web-sdk/v6/core"
    : "https://www.sandbox.paypal.com/web-sdk/v6/core";
}

export function loadPayPalV6Sdk(environment: "sandbox" | "live") {
  const paypalWindow = window as unknown as { paypal?: PayPalV6Namespace };
  if (paypalWindow.paypal?.createInstance && activeEnvironment === environment) return Promise.resolve(paypalWindow.paypal);
  if (loading && activeEnvironment === environment) return loading;

  document.querySelector("script[data-tipme-paypal-sdk]")?.remove();
  document.querySelector("script[data-tipme-paypal-v6]")?.remove();
  paypalWindow.paypal = undefined;
  activeEnvironment = environment;
  loading = new Promise<PayPalV6Namespace>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = buildPayPalV6SdkScript(environment);
    script.async = true;
    script.dataset.tipmePaypalV6 = "true";
    script.onload = () => paypalWindow.paypal?.createInstance
      ? resolve(paypalWindow.paypal)
      : reject(new Error("paypal_v6_sdk_missing"));
    script.onerror = () => {
      loading = null;
      activeEnvironment = null;
      reject(new Error("paypal_v6_sdk_failed"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export function loadApplePaySdk() {
  if (getApplePaySession()) return Promise.resolve();
  if (applePayLoading) return applePayLoading;
  applePayLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.tipmeApplePaySdk = "true";
    script.onload = () => getApplePaySession() ? resolve() : reject(new Error("apple_pay_sdk_missing"));
    script.onerror = () => {
      applePayLoading = null;
      reject(new Error("apple_pay_sdk_failed"));
    };
    document.head.appendChild(script);
  });
  return applePayLoading;
}

export function getApplePaySession() {
  return (window as unknown as { ApplePaySession?: ApplePaySessionConstructor }).ApplePaySession;
}

export function canUseApplePay() {
  try {
    return Boolean(window.isSecureContext && getApplePaySession()?.canMakePayments());
  } catch {
    return false;
  }
}

export function buildApplePayPaymentRequest(input: {
  amountMinor: number;
  countryCode: string;
  locale: Locale;
  config: Record<string, unknown>;
}) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error("invalid_money");
  if (!/^[A-Z]{2}$/.test(input.countryCode)) throw new Error("invalid_country");
  return {
    ...input.config,
    countryCode: input.countryCode,
    currencyCode: "USD",
    total: { label: "TipMe", amount: `${Math.floor(input.amountMinor / 100)}.${String(input.amountMinor % 100).padStart(2, "0")}`, type: "final" },
    requiredBillingContactFields: ["name", "postalAddress"],
    requiredShippingContactFields: [],
  };
}
