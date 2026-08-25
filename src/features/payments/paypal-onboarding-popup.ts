export const PAYPAL_ONBOARDING_WINDOW = "PPFrame";

export type PayPalOnboardingPopupStatus = "connected" | "restricted" | "invalid" | "unavailable";

export function addPayPalMiniBrowserDisplayMode(actionUrl: string) {
  const url = new URL(actionUrl);
  url.searchParams.set("displayMode", "minibrowser");
  return url.toString();
}

export function shouldRelayPayPalOnboardingResult(input: { windowName: string; hasOpener: boolean; isEmbedded?: boolean }) {
  return input.windowName === PAYPAL_ONBOARDING_WINDOW && (input.hasOpener || input.isEmbedded === true);
}

export type PayPalOnboardingStatusResult = { status: "pending" | "restricted" | "connected"; cardPaymentsEnabled?: boolean };

export function getPayPalConnectControlState(input: {
  onboardingStarted: boolean;
  opening: boolean;
  manualChecking: boolean;
}) {
  return {
    connectDisabled: input.opening || input.onboardingStarted,
    verifyDisabled: !input.onboardingStarted || input.manualChecking,
  };
}

export async function pollPayPalOnboardingStatus(
  check: () => Promise<PayPalOnboardingStatusResult>,
  wait: () => Promise<void>,
  attempts: number,
) {
  let latest: PayPalOnboardingStatusResult = { status: "pending" };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    latest = await check();
    if (latest.status === "connected") return latest;
    if (attempt < attempts - 1) await wait();
  }
  return latest;
}

const popupDestinations: Record<PayPalOnboardingPopupStatus, string> = {
  connected: "/onboarding?step=2&paypal=connected",
  restricted: "/onboarding?step=2&error=paypal_restricted",
  invalid: "/onboarding?step=2&error=paypal_invalid",
  unavailable: "/onboarding?step=2&error=paypal_unavailable",
};

export function resolvePayPalOnboardingMessage(
  event: { origin: string; data: unknown },
  expectedOrigin: string,
) {
  if (event.origin !== expectedOrigin || !event.data || typeof event.data !== "object") return null;
  const message = event.data as { type?: unknown; status?: unknown };
  if (message.type !== "tipme:paypal-onboarding" || typeof message.status !== "string") return null;
  return popupDestinations[message.status as PayPalOnboardingPopupStatus] ?? null;
}
