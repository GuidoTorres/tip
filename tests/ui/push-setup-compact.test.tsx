/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushState = vi.hoisted(() => ({ current: "ready" as "ready" | "active" }));

vi.mock("@/features/notifications/push-subscription-client", () => ({
  persistPushSubscription: vi.fn(),
  syncExistingPushSubscription: vi.fn(async () => pushState.current),
}));

import { PushSetup } from "@/components/push/push-setup";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderCompactPush() {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(<PushSetup vapidPublicKey="test-key" compact />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, html: container.innerHTML, root };
}

async function renderHeaderPush() {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(<PushSetup vapidPublicKey="test-key" header />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, html: container.innerHTML, root };
}

describe("compact push setup", () => {
  beforeEach(() => {
    pushState.current = "ready";
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn() } }) },
    });
    Object.defineProperty(window, "PushManager", { configurable: true, value: class PushManager {} });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "default", requestPermission: vi.fn() },
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
  });

  it("renders an inactive icon-only control with an accessible label", async () => {
    const { container, html, root } = await renderCompactPush();
    const button = container.querySelector("button");

    expect(button?.getAttribute("aria-label")).toBe("Activar notificaciones");
    expect(button?.getAttribute("title")).toBe("Activar notificaciones");
    expect(button?.textContent?.trim()).toBe("");
    expect(html).toContain("size-11");
    expect(html).not.toContain("w-full");
    await act(async () => root.unmount());
  });

  it("renders the active notification state with an accent icon", async () => {
    pushState.current = "active";
    const { container, html, root } = await renderCompactPush();
    const status = container.querySelector('[role="status"]');

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Notificaciones activadas"');
    expect(html).toContain("bg-accent");
    expect(status?.textContent?.trim()).toBe("");
    await act(async () => root.unmount());
  });

  it("keeps the header control icon-only while notifications are inactive", async () => {
    const { container, html, root } = await renderHeaderPush();
    const button = container.querySelector("button");

    expect(button?.getAttribute("aria-label")).toBe("Activar notificaciones");
    expect(button?.textContent?.trim()).toBe("");
    expect(html).toContain("size-11");
    expect(html).not.toContain("No pudimos");
    await act(async () => root.unmount());
  });
});
