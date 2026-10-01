import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaymentTimingPanel } from "@/components/payments/payment-timing-panel";

describe("PaymentTimingPanel", () => {
  it("shows readable durations and identifies the slowest completed stage", () => {
    const html = renderToStaticMarkup(<PaymentTimingPanel entries={[
      { stage: "checkout_bootstrap", status: "completed", durationMs: 480 },
      { stage: "paypal_sdk_load", status: "completed", durationMs: 1_275 },
      { stage: "capture", status: "pending", durationMs: null },
    ]} locale="es" />);

    expect(html).toContain("Diagnóstico de pago");
    expect(html).toContain("Preparar checkout");
    expect(html).toContain("480 ms");
    expect(html).toContain("Cargar SDK de PayPal");
    expect(html).toContain("1.28 s");
    expect(html).toContain("Más lento");
    expect(html).toContain("Midiendo…");
  });

  it("does not mistake the payer's interaction time for a technical bottleneck", () => {
    const html = renderToStaticMarkup(<PaymentTimingPanel entries={[
      { stage: "paypal_sdk_load", status: "completed", durationMs: 1_275 },
      { stage: "paypal_interaction", status: "completed", durationMs: 42_000 },
    ]} locale="es" />);
    const sdkRow = html.slice(html.indexOf("Cargar SDK de PayPal"), html.indexOf("Interacción en PayPal"));
    const interactionRow = html.slice(html.indexOf("Interacción en PayPal"));

    expect(sdkRow).toContain("Más lento");
    expect(interactionRow).not.toContain("Más lento");
  });
});
