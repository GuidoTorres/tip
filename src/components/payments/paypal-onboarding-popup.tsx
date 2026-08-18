"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  resolvePayPalOnboardingMessage,
  shouldRelayPayPalOnboardingResult,
  type PayPalOnboardingPopupStatus,
} from "@/features/payments/paypal-onboarding-popup";

export function PayPalOnboardingPopup({ result }: { result?: PayPalOnboardingPopupStatus }) {
  const router = useRouter();

  useEffect(() => {
    const hasOpener = Boolean(window.opener && !window.opener.closed);
    const isEmbedded = window.parent !== window;
    if (!result || !shouldRelayPayPalOnboardingResult({ windowName: window.name, hasOpener, isEmbedded })) return;
    const recipient = hasOpener ? window.opener : window.parent;
    recipient.postMessage({ type: "tipme:paypal-onboarding", status: result }, window.location.origin);
    if (hasOpener) window.close();
  }, [result]);

  useEffect(() => {
    const receiveResult = (event: MessageEvent) => {
      const destination = resolvePayPalOnboardingMessage(event, window.location.origin);
      if (!destination) return;
      router.replace(destination);
      router.refresh();
    };
    window.addEventListener("message", receiveResult);
    return () => window.removeEventListener("message", receiveResult);
  }, [router]);

  return null;
}
