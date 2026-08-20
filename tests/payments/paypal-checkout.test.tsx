import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { PayPalCheckout } from "@/components/payments/paypal-checkout";

describe("PayPal embedded checkout", () => {
  it("shows one final card action and PayPal as a visible alternative", () => {
    const html = renderToStaticMarkup(<PayPalCheckout
      checkout={{ kind: "embedded", clientId: "client", merchantId: "merchant", clientToken: "token", partnerAttributionId: "BN" }}
      locale="es"
      createOrder={async () => ({ tipId: "tip-1", orderId: "ORDER-1", receiptToken: "receipt" })}
    />);
    expect(html).toContain("paypal-card-number");
    expect(html).toContain("paypal-card-expiry");
    expect(html).toContain("paypal-card-cvv");
    expect(html).not.toContain("paypal-card-name");
    expect(html).not.toContain("Nombre del titular");
    expect(html).toContain("ENVIAR TIP");
    expect(html).toContain("O paga con");
    expect(html).toContain("paypal-button-container");
    expect(html).not.toContain('aria-hidden="true"');
    expect(html).toContain("PayPal procesa este pago");
    expect(html).not.toContain("Pago confirmado");
  });
});
