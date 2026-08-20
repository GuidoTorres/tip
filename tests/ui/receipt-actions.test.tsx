/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ReceiptActions } from "@/components/tips/receipt-actions";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("receipt actions", () => {
  it("copies the exact operation code and confirms the action", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<ReceiptActions tipId="tip-1" token="token" operationCode="TM-7A4F-91C2-D8B0-1234" canShare={false} />));

    const copyButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Copiar código"));
    await act(async () => copyButton?.click());

    expect(writeText).toHaveBeenCalledWith("TM-7A4F-91C2-D8B0-1234");
    expect(container.textContent).toContain("Copiado");
    expect(container.textContent).not.toContain("Compartir recibo");
    await act(async () => root.unmount());
  });
});
