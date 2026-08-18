import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PayPalFundsPanel } from "@/components/payouts/paypal-funds-panel";
import { BalanceSummary } from "@/components/dashboard/balance-summary";

describe("PayPal mode interface", () => {
  it("does not offer an internal TipMe withdrawal", () => {
    const dashboard = renderToStaticMarkup(<BalanceSummary currency="USD" availableMinor={1860} pendingMinor={0} paymentProvider="paypal" />);
    const funds = renderToStaticMarkup(<PayPalFundsPanel currency="USD" netConfirmedMinor={1860} pendingMinor={0} connected />);
    expect(dashboard).toContain("Neto confirmado");
    expect(dashboard).not.toContain("VER EN PAYPAL");
    expect(funds).toContain("El dinero llega a tu cuenta PayPal");
    expect(funds).not.toContain("RETIRAR AHORA");
  });

  it("labels single-merchant Sandbox money without claiming creator ownership", () => {
    const dashboard = renderToStaticMarkup(<BalanceSummary currency="USD" availableMinor={1940} pendingMinor={0} paymentProvider="paypal" sandboxSingleMerchant />);
    const funds = renderToStaticMarkup(<PayPalFundsPanel currency="USD" netConfirmedMinor={1940} pendingMinor={0} connected sandboxSingleMerchant />);
    expect(dashboard).toContain("Neto confirmado · Sandbox");
    expect(dashboard).not.toContain("VER SANDBOX");
    expect(dashboard).toContain("cuenta Sandbox de TipMe");
    expect(funds).toContain("No es un saldo retirable por la persona creadora");
    expect(funds).toContain("sandbox.paypal.com");
  });
});
