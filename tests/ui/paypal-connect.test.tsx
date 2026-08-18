import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import { PayPalConnect } from "@/components/payments/paypal-connect";
import * as popupModule from "@/features/payments/paypal-onboarding-popup";
import { resolvePayPalOnboardingMessage, shouldRelayPayPalOnboardingResult } from "@/features/payments/paypal-onboarding-popup";

describe("PayPal creator connection", () => {
  it("offers a server-verified fallback when PayPal leaves the seller on its final page", () => {
    const html = renderToStaticMarkup(<PayPalConnect connected={false} cardEnabled={false} />);

    expect(html).toContain("Conectar PayPal");
    expect(html).toContain("Ya terminé en PayPal");
  });

  it("confirms that the TipMe account is linked before continuing", () => {
    const html = renderToStaticMarkup(<PayPalConnect connected cardEnabled />);

    expect(html).toContain("Cuenta PayPal enlazada");
    expect(html).toContain("Ya puedes recibir tips en esta cuenta.");
    expect(html).toContain('/onboarding?step=3');
  });

  it("accepts a completed onboarding message only from TipMe itself", () => {
    expect(resolvePayPalOnboardingMessage({ origin: "https://tipme.pro", data: { type: "tipme:paypal-onboarding", status: "connected" } }, "https://tipme.pro"))
      .toBe("/onboarding?step=2&paypal=connected");
    expect(resolvePayPalOnboardingMessage({ origin: "https://attacker.example", data: { type: "tipme:paypal-onboarding", status: "connected" } }, "https://tipme.pro"))
      .toBeNull();
  });

  it("relays the verified result from PayPal's PPFrame back to TipMe", () => {
    expect(shouldRelayPayPalOnboardingResult({ windowName: "PPFrame", hasOpener: true })).toBe(true);
    expect(shouldRelayPayPalOnboardingResult({ windowName: "untrusted-window", hasOpener: true })).toBe(false);
  });

  it("keeps checking until PayPal exposes the connected seller", async () => {
    const poll = (popupModule as unknown as {
      pollPayPalOnboardingStatus?: (check: () => Promise<{ status: string }>, wait: () => Promise<void>, attempts: number) => Promise<{ status: string }>;
    }).pollPayPalOnboardingStatus;
    expect(poll).toBeTypeOf("function");
    if (!poll) return;
    const check = vi.fn()
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "connected" });

    await expect(poll(check, async () => undefined, 3)).resolves.toEqual({ status: "connected" });
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("blocks reconnecting once PayPal has opened and then enables manual verification", () => {
    const getControlState = (popupModule as unknown as {
      getPayPalConnectControlState?: (input: {
        onboardingStarted: boolean;
        opening: boolean;
        manualChecking: boolean;
      }) => { connectDisabled: boolean; verifyDisabled: boolean };
    }).getPayPalConnectControlState;
    expect(getControlState).toBeTypeOf("function");
    if (!getControlState) return;

    expect(getControlState({ onboardingStarted: false, opening: false, manualChecking: false }))
      .toEqual({ connectDisabled: false, verifyDisabled: true });
    expect(getControlState({ onboardingStarted: true, opening: false, manualChecking: false }))
      .toEqual({ connectDisabled: true, verifyDisabled: false });
    expect(getControlState({ onboardingStarted: true, opening: false, manualChecking: true }))
      .toEqual({ connectDisabled: true, verifyDisabled: true });
  });

});
