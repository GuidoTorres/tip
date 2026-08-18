"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PaypalLogo } from "@phosphor-icons/react";
import {
  getPayPalConnectControlState,
  PAYPAL_ONBOARDING_WINDOW,
  pollPayPalOnboardingStatus,
  type PayPalOnboardingStatusResult,
} from "@/features/payments/paypal-onboarding-popup";

const PAYPAL_POLL_ATTEMPTS = 40;
const PAYPAL_POLL_INTERVAL_MS = 3_000;

function waitForNextCheck() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, PAYPAL_POLL_INTERVAL_MS));
}

export function PayPalConnectForm() {
  const router = useRouter();
  const popupRef = useRef<Window | null>(null);
  const pollGeneration = useRef(0);
  const [opening, setOpening] = useState(false);
  const [onboardingStarted, setOnboardingStarted] = useState(false);
  const [manualChecking, setManualChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const checkStatus = useCallback(async (): Promise<PayPalOnboardingStatusResult> => {
    const response = await fetch("/api/paypal/onboarding/status", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const result = await response.json() as Partial<PayPalOnboardingStatusResult>;
    if (!response.ok || !["pending", "restricted", "connected"].includes(result.status ?? "")) {
      throw new Error("paypal_status_unavailable");
    }
    return result as PayPalOnboardingStatusResult;
  }, []);

  const acceptVerifiedStatus = useCallback((result: PayPalOnboardingStatusResult) => {
    if (result.status !== "connected") return false;
    pollGeneration.current += 1;
    popupRef.current?.close();
    popupRef.current = null;
    window.sessionStorage.removeItem("tipme_paypal_onboarding_pending");
    setOnboardingStarted(false);
    router.replace("/onboarding?step=2&paypal=connected");
    router.refresh();
    return true;
  }, [router]);

  const monitorPayPal = useCallback(async () => {
    const generation = pollGeneration.current + 1;
    pollGeneration.current = generation;
    setMessage("Esperando la confirmación segura de PayPal…");
    try {
      const result = await pollPayPalOnboardingStatus(checkStatus, waitForNextCheck, PAYPAL_POLL_ATTEMPTS);
      if (generation !== pollGeneration.current || acceptVerifiedStatus(result)) return;
      setMessage(result.status === "restricted"
        ? "PayPal asoció la cuenta, pero todavía está completando su activación. Puedes comprobarla nuevamente."
        : "PayPal aún no confirma la asociación. Cuando termines allí, pulsa “Ya terminé en PayPal”.");
    } catch {
      if (generation === pollGeneration.current) setMessage("No pudimos comprobar PayPal en este momento. Inténtalo nuevamente.");
    }
  }, [acceptVerifiedStatus, checkStatus]);

  useEffect(() => {
    let active = true;
    let resumeTimer: number | undefined;
    const pendingOnboarding = window.sessionStorage.getItem("tipme_paypal_onboarding_pending") === "true";
    if (pendingOnboarding) {
      resumeTimer = window.setTimeout(() => {
        if (!active) return;
        setOnboardingStarted(true);
        void monitorPayPal();
      }, 0);
    } else {
      void checkStatus().then((result) => {
        if (active) acceptVerifiedStatus(result);
      }).catch(() => undefined);
    }
    return () => {
      active = false;
      if (resumeTimer !== undefined) window.clearTimeout(resumeTimer);
      pollGeneration.current += 1;
    };
  }, [acceptVerifiedStatus, checkStatus, monitorPayPal]);

  const beginOnboarding = async () => {
    if (opening || onboardingStarted) return;
    setOpening(true);
    setMessage(null);
    const popup = window.open("", PAYPAL_ONBOARDING_WINDOW, "popup=yes,width=520,height=720,resizable=yes,scrollbars=yes");
    popupRef.current = popup;
    try {
      const response = await fetch("/api/paypal/onboarding", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const result = await response.json() as { actionUrl?: string };
      if (!response.ok || !result.actionUrl) throw new Error("paypal_onboarding_unavailable");

      window.sessionStorage.setItem("tipme_paypal_onboarding_pending", "true");
      setOnboardingStarted(true);
      if (popup) {
        popup.location.assign(result.actionUrl);
        popup.focus();
        setOpening(false);
        void monitorPayPal();
        return;
      }
      window.location.assign(result.actionUrl);
    } catch {
      popup?.close();
      popupRef.current = null;
      window.sessionStorage.removeItem("tipme_paypal_onboarding_pending");
      setOnboardingStarted(false);
      setMessage("No pudimos abrir PayPal. Inténtalo nuevamente.");
      setOpening(false);
    }
  };

  const verifyNow = async () => {
    if (!onboardingStarted || manualChecking) return;
    setManualChecking(true);
    setMessage("Comprobando la asociación con PayPal…");
    try {
      const result = await checkStatus();
      if (acceptVerifiedStatus(result)) return;
      setMessage(result.status === "restricted"
        ? "La cuenta está asociada, pero PayPal todavía está completando su activación."
        : "PayPal todavía no registra una cuenta asociada. Revisa que hayas terminado todos sus pasos.");
    } catch {
      setMessage("No pudimos comprobar PayPal en este momento. Inténtalo nuevamente.");
    } finally {
      setManualChecking(false);
    }
  };

  const controls = getPayPalConnectControlState({ onboardingStarted, opening, manualChecking });

  return <div className="mt-5">
    <button type="button" onClick={beginOnboarding} disabled={controls.connectDisabled} className="pressable flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#0070e0] px-6 py-4 font-bold text-white hover:bg-[#005ea6] disabled:cursor-not-allowed disabled:opacity-70"><PaypalLogo size={22} weight="fill" /> {opening ? "Abriendo PayPal…" : onboardingStarted ? "PayPal abierto" : "Conectar PayPal"}</button>
    <button type="button" onClick={verifyNow} disabled={controls.verifyDisabled} className="pressable mt-3 flex min-h-12 w-full items-center justify-center rounded-full border border-border px-5 font-semibold text-foreground hover:border-accent disabled:cursor-not-allowed disabled:opacity-60">{manualChecking ? "Comprobando…" : "Ya terminé en PayPal"}</button>
    {message && <p role="status" aria-live="polite" className="mt-3 text-sm text-muted">{message}</p>}
  </div>;
}
