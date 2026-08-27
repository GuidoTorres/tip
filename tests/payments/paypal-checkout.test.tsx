import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { PayPalCheckout } from "@/components/payments/paypal-checkout";

describe("PayPal embedded checkout", () => {
  it("presents the compact card form as a secure PayPal payment", () => {
    const html = renderToStaticMarkup(<PayPalCheckout
      checkout={{ kind: "embedded", sdkVersion: "v6", environment: "live", clientId: "client", clientToken: "browser-safe-token", merchantId: "merchant", merchantCountry: "PE", partnerAttributionId: "BN" }}
      locale="es"
      amountMinor={2_000}
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
    expect(html).toContain('id="paypal-button-container" class="mx-auto mt-3 flex min-h-12 w-full max-w-sm justify-center"');
    expect(html).toContain("apple-pay-button-container");
    expect(html).toContain('data-hosted-card-fallback="true"');
    expect(html).toContain("Pagar con tarjeta");
    expect(html).not.toContain('aria-hidden="true"');
    expect(html).toContain("Pago seguro");
    expect(html).toContain("Procesado por PayPal");
    expect(html).toContain("min-h-11");
    expect(html).toContain("PayPal protege y procesa tus datos de pago");
    expect(html).not.toContain("Ã");
    expect(html).not.toContain("Pagar de forma segura");
    expect(html).not.toContain("Pago confirmado");
  });
});
