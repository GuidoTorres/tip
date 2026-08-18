import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { PayPalCheckout } from "@/components/payments/paypal-checkout";

describe("PayPal embedded checkout", () => {
  it("prioritizes the three required card fields and hides the PayPal fallback", () => {
    const html = renderToStaticMarkup(<PayPalCheckout
      tipId="tip-1" orderId="ORDER-1" receiptToken="receipt"
      checkout={{ kind: "embedded", clientId: "client", merchantId: "merchant", clientToken: "token", partnerAttributionId: "BN" }}
      locale="es"
    />);
    expect(html).toContain("paypal-card-number");
    expect(html).toContain("paypal-card-expiry");
    expect(html).toContain("paypal-card-cvv");
    expect(html).not.toContain("paypal-card-name");
    expect(html).not.toContain("Nombre del titular");
    expect(html).toContain("paypal-button-container");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("PayPal procesa este pago");
    expect(html).not.toContain("Pago confirmado");
  });
});
