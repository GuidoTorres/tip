type PayPalField = { render(selector: string): Promise<void> | void };
export type PayPalCardFields = {
  isEligible(): boolean;
  NameField(): PayPalField;
  NumberField(): PayPalField;
  ExpiryField(): PayPalField;
  CVVField(): PayPalField;
  submit(): Promise<void>;
};
type PayPalButtons = { isEligible(): boolean; render(selector: string): Promise<void> | void };
export type PayPalNamespace = {
  CardFields(options: Record<string, unknown>): PayPalCardFields;
  Buttons(options: Record<string, unknown>): PayPalButtons;
};

declare global { interface Window { paypal?: PayPalNamespace } }

let activeKey: string | null = null;
let loading: { key: string; promise: Promise<PayPalNamespace> } | null = null;

type PayPalSdkInput = { clientId: string; merchantId: string; clientToken: string; partnerAttributionId?: string };

export function buildPayPalSdkScript(input: PayPalSdkInput) {
  const query = new URLSearchParams({
    "client-id": input.clientId,
    "merchant-id": input.merchantId,
    currency: "USD",
    intent: "capture",
    components: "buttons,card-fields",
  });
  return {
    src: `https://www.paypal.com/sdk/js?${query.toString()}`,
    dataset: { clientToken: input.clientToken, ...(input.partnerAttributionId ? { partnerAttributionId: input.partnerAttributionId } : {}) },
  };
}

export function loadPayPalSdk(input: PayPalSdkInput) {
  const key = `${input.clientId}:${input.merchantId}:${input.clientToken}`;
  if (window.paypal && activeKey === key) return Promise.resolve(window.paypal);
  if (loading?.key === key) return loading.promise;
  if (activeKey && activeKey !== key) {
    document.querySelector("script[data-tipme-paypal-sdk]")?.remove();
    window.paypal = undefined;
  }
  activeKey = key;
  const promise = new Promise<PayPalNamespace>((resolve, reject) => {
    const config = buildPayPalSdkScript(input);
    const script = document.createElement("script");
    script.src = config.src;
    script.async = true;
    script.dataset.tipmePaypalSdk = "true";
    Object.assign(script.dataset, config.dataset);
    script.onload = () => window.paypal ? resolve(window.paypal) : reject(new Error("paypal_sdk_missing"));
    script.onerror = () => {
      loading = null;
      activeKey = null;
      reject(new Error("paypal_sdk_failed"));
    };
    document.head.appendChild(script);
  });
  loading = { key, promise };
  return promise;
}
