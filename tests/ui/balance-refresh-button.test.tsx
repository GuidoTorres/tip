/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { BalanceRefreshButton } from "@/components/dashboard/balance-refresh-button";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("balance refresh button", () => {
  it("refreshes dashboard server data without leaving the installed PWA", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<BalanceRefreshButton />));
    const button = container.querySelector("button");

    expect(button?.getAttribute("aria-label")).toBe("Actualizar saldo");
    expect(button?.className).toContain("size-11");
    await act(async () => button?.click());
    expect(refresh).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
  });
});
