/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/actions", () => ({ logout: vi.fn() }));
vi.mock("@/components/push/push-setup", () => ({
  PushSetup: ({ header }: { header?: boolean }) => <span data-header-push={String(header)} />,
}));

import { DashboardHeaderActions } from "@/components/dashboard/header-actions";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("dashboard header actions", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows push activation and an icon-only logout control", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<DashboardHeaderActions vapidPublicKey="test-key" />));

    expect(container.querySelector('[data-header-push="true"]')).not.toBeNull();
    const logoutButton = container.querySelector('button[aria-label="Cerrar sesión"]');
    expect(logoutButton).not.toBeNull();
    expect(logoutButton?.textContent?.trim()).toBe("");
    await act(async () => root.unmount());
  });

  it("cancels logout when the creator does not confirm", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<DashboardHeaderActions vapidPublicKey="test-key" />));
    const form = container.querySelector("form");
    const submit = new Event("submit", { bubbles: true, cancelable: true });

    await act(async () => form?.dispatchEvent(submit));

    expect(window.confirm).toHaveBeenCalledWith("¿Deseas cerrar sesión?");
    expect(submit.defaultPrevented).toBe(true);
    await act(async () => root.unmount());
  });
});
