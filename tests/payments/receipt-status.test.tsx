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
        amount_minor: 2000,
        currency: "USD",
        message: "Gracias",
        profiles: username ? { public_name: "Camila", username } : null,
      }}
      token="receipt-token"
    />,
  );
}

describe("ReceiptStatus repeat tip action", () => {
  it("returns a confirmed fan to the same creator profile", () => {
    const receipt = renderReceipt("confirmed", "camila");

    expect(receipt).toContain('href="/camila"');
    expect(receipt).toContain("Enviar otro tip");
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
