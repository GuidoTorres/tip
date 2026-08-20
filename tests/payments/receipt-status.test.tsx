import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReceiptStatus } from "@/components/tips/receipt-status";
import type { TipStatus } from "@/features/payments/types";

function renderReceipt(status: TipStatus, username: string | null) {
  return renderToStaticMarkup(
    <ReceiptStatus
      initial={{
        id: "tip-123",
        status,
        base_amount_minor: 2000,
        processing_support_minor: 146,
        amount_minor: 2146,
        currency: "USD",
        provider: "paypal",
        operation_code: "TM-7A4F-91C2-D8B0-1234",
        message: "Gracias",
        profiles: username ? { public_name: "Camila", username } : null,
      }}
      token="receipt-token"
    />,
  );
}

describe("ReceiptStatus repeat tip action", () => {
  it("shows the operation code that the creator can verify", () => {
    const receipt = renderReceipt("confirmed", "camila");

    expect(receipt).toContain("Código de operación");
    expect(receipt).toContain("TM-7A4F-91C2-D8B0-1234");
    expect(receipt).toContain("Copiar código");
    expect(receipt).toContain("Compartir recibo");
  });

  it("separates the creator tip from the fan's voluntary processing support", () => {
    const receipt = renderReceipt("confirmed", "camila");

    expect(receipt).toContain("20,00");
    expect(receipt).toContain("Aporte al procesamiento");
    expect(receipt).toContain("Total pagado");
    expect(receipt).toContain("21,46");
  });

  it("returns a confirmed fan to the same creator profile", () => {
    const receipt = renderReceipt("confirmed", "camila");

    expect(receipt).toContain('href="/camila"');
    expect(receipt).toContain("Enviar otro tip");
    expect(receipt).toContain("Procesado por PayPal");
    expect(receipt).toContain("operaciones no autorizadas");
  });

  it("lets a fan retry a rejected payment with the same creator", () => {
    const receipt = renderReceipt("rejected", "camila");

    expect(receipt).toContain('href="/camila"');
    expect(receipt).toContain("Intentar nuevamente");
  });

  it("does not invite another payment while confirmation is pending", () => {
    const receipt = renderReceipt("pending", "camila");

    expect(receipt).not.toContain('href="/camila"');
    expect(receipt).not.toContain("Enviar otro tip");
    expect(receipt).not.toContain("Intentar nuevamente");
    expect(receipt).toContain("Copiar código");
    expect(receipt).not.toContain("Compartir recibo");
  });

  it("omits the action when the protected receipt has no creator username", () => {
    const receipt = renderReceipt("confirmed", null);

    expect(receipt).not.toContain("Enviar otro tip");
  });

  it("usa lenguaje neutral cuando el perfil no está disponible", () => {
    const receipt = renderReceipt("confirmed", null);

    expect(receipt).toContain("este perfil");
    expect(receipt.toLowerCase()).not.toContain("creadora");
  });
});
