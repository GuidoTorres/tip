import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PayPalFundsPanel } from "@/components/payouts/paypal-funds-panel";
import { BalanceSummary } from "@/components/dashboard/balance-summary";
import { PayPalConnectionBadge } from "@/components/dashboard/paypal-connection-badge";

describe("PayPal mode interface", () => {
  it("does not offer an internal TipMe withdrawal", () => {
    const dashboard = renderToStaticMarkup(<BalanceSummary currency="USD" availableMinor={1860} pendingMinor={0} todayMinor={2000} grossConfirmedMinor={2000} feesMinor={140} paymentProvider="paypal" shareActions={<span>tipme.pro/camila</span>} />);
    const funds = renderToStaticMarkup(<PayPalFundsPanel currency="USD" netConfirmedMinor={1860} pendingMinor={0} connected />);
    expect(dashboard).toContain("Total confirmado");
    expect(dashboard).toContain("Comisiones descontadas");
    expect(dashboard).toContain("Total neto");
    expect(dashboard).not.toContain("Pendiente");
    expect(dashboard).not.toContain("Este mes");
    expect(dashboard).not.toContain("VER EN PAYPAL");
    expect(funds).toContain("El dinero llega a tu cuenta PayPal");
    expect(funds).not.toContain("RETIRAR AHORA");
  });

  it("labels single-merchant Sandbox money without claiming creator ownership", () => {
    const dashboard = renderToStaticMarkup(<BalanceSummary currency="USD" availableMinor={1940} pendingMinor={0} grossConfirmedMinor={2000} feesMinor={60} paymentProvider="paypal" sandboxSingleMerchant />);
    const funds = renderToStaticMarkup(<PayPalFundsPanel currency="USD" netConfirmedMinor={1940} pendingMinor={0} connected sandboxSingleMerchant />);
    expect(dashboard).toContain("Total confirmado · Sandbox");
    expect(dashboard).not.toContain("VER SANDBOX");
    expect(dashboard).toContain("cuenta Sandbox de TipMe");
    expect(funds).toContain("No es un saldo retirable por la persona creadora");
    expect(funds).toContain("sandbox.paypal.com");
  });

  it("offers withdrawals when PayPal runs in platform payouts mode", () => {
    const dashboard = renderToStaticMarkup(<BalanceSummary currency="USD" availableMinor={1839} pendingMinor={2146} todayMinor={2000} grossConfirmedMinor={2000} paymentProvider="paypal" platformPayouts />);
    const pendingBadge = renderToStaticMarkup(<PayPalConnectionBadge verified={false} />);

    expect(dashboard).toContain("Disponible");
    expect(dashboard).toContain("Total recibido");
    expect(dashboard).toContain("20,00");
    expect(dashboard).not.toContain("21,46");
    expect(dashboard).not.toContain("Pendiente");
    expect(dashboard).toContain("RETIRAR");
    expect(pendingBadge).toContain("PayPal configurado");
    expect(pendingBadge).not.toContain("PayPal verificado");
  });
});
