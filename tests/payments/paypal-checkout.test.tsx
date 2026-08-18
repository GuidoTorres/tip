import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { PayPalCheckout } from "@/components/payments/paypal-checkout";

describe("PayPal embedded checkout", () => {
  it("renders secure card containers and PayPal as an alternative", () => {
    const html = renderToStaticMarkup(<PayPalCheckout
      tipId="tip-1" orderId="ORDER-1" receiptToken="receipt"
      checkout={{ kind: "embedded", clientId: "client", merchantId: "merchant", clientToken: "token", partnerAttributionId: "BN" }}
      locale="es"
    />);
    expect(html).toContain("Número de tarjeta");
    expect(html).toContain("paypal-card-number");
    expect(html).toContain("paypal-button-container");
    expect(html).toContain("PayPal procesa este pago");
    expect(html).not.toContain("Pago confirmado");
  });
});
