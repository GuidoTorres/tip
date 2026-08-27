import { describe, expect, it } from "vitest";
import { buildApplePayPaymentRequest, buildPayPalV6SdkScript } from "@/components/payments/paypal-sdk-v6";

describe("PayPal Web SDK v6", () => {
  it("loads the matching PayPal environment without credentials in the URL", () => {
    expect(buildPayPalV6SdkScript("sandbox")).toBe("https://www.sandbox.paypal.com/web-sdk/v6/core");
    expect(buildPayPalV6SdkScript("live")).toBe("https://www.paypal.com/web-sdk/v6/core");
  });

  it("builds an Apple Pay request with the exact server-priced USD amount", () => {
    expect(buildApplePayPaymentRequest({
      amountMinor: 2_000,
      countryCode: "PE",
      locale: "es",
      config: { merchantCapabilities: ["supports3DS"], supportedNetworks: ["visa", "masterCard"] },
    })).toEqual({
      merchantCapabilities: ["supports3DS"],
      supportedNetworks: ["visa", "masterCard"],
      countryCode: "PE",
      currencyCode: "USD",
      total: { label: "TipMe", amount: "20.00", type: "final" },
      requiredBillingContactFields: ["name", "postalAddress"],
      requiredShippingContactFields: [],
    });
  });
});
