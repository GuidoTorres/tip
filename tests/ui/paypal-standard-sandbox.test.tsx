import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PayPalSandboxAccount } from "@/components/payments/paypal-sandbox-account";
import { buildPayPalSdkScript } from "@/components/payments/paypal-sdk";

describe("PayPal standard Sandbox mode", () => {
  it("discloses the simulated creator connection without a real connect action", () => {
    const html = renderToStaticMarkup(<PayPalSandboxAccount />);
    expect(html).toContain("Cuenta de prueba conectada");
    expect(html).toContain("no se distribuirá realmente");
    expect(html).toContain("/onboarding?step=3");
    expect(html).not.toContain("Conectar PayPal");
  });

  it("builds the PayPal SDK script without a partner attribution attribute", () => {
    const script = buildPayPalSdkScript({ clientId: "client", merchantId: "merchant", clientToken: "token" });
    expect(script.src).toContain("components=buttons%2Ccard-fields");
    expect(script.dataset).toEqual({ clientToken: "token" });
  });
});
