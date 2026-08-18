"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle, ShareNetwork, WarningCircle } from "@phosphor-icons/react";
import {
  persistPushSubscription,
  syncExistingPushSubscription,
} from "@/features/notifications/push-subscription-client";

type State = "checking" | "unsupported" | "install-ios" | "ready" | "active" | "denied" | "error";

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function toUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function PushSetup({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let active = true;
    async function check() {
      await Promise.resolve();
      if (!active) return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported"); return;
      }
      if (isIos() && !isStandalone()) { setState("install-ios"); return; }
      if (Notification.permission === "denied") { setState("denied"); return; }
      try {
        const registration = await navigator.serviceWorker.ready;
        const nextState = await syncExistingPushSubscription(
          () => registration.pushManager.getSubscription(),
        );
        if (active) setState(nextState);
      } catch { if (active) setState("error"); }
    }
    void check();
    return () => { active = false; };
  }, []);

  async function enable() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState("denied"); return; }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8Array(vapidPublicKey) });
      await persistPushSubscription(subscription);
      setState("active");
    } catch { setState("error"); }
  }

  if (state === "checking") return <div className="h-32 animate-pulse rounded-2xl bg-surface-soft" aria-label="Comprobando notificaciones" />;
  if (state === "unsupported") return <p className="rounded-2xl bg-surface-soft p-4 text-sm text-muted">Este navegador no admite Web Push. TipMe seguirá funcionando normalmente.</p>;
  if (state === "install-ios") return <div className="rounded-2xl bg-surface-soft p-5"><ShareNetwork size={26} className="text-accent" /><h3 className="mt-3 font-semibold">Recibe tus tips al instante</h3><ol className="mt-3 space-y-2 text-sm text-muted"><li>1. Pulsa Compartir.</li><li>2. Selecciona “Añadir a pantalla de inicio”.</li><li>3. Abre TipMe desde el icono.</li><li>4. Activa las notificaciones.</li></ol></div>;
  if (state === "active") return <p className="flex items-center gap-2 rounded-2xl bg-surface-soft p-4 font-semibold text-success"><CheckCircle size={22} weight="fill" /> Notificaciones activadas</p>;
  if (state === "denied") return <div className="rounded-2xl bg-surface-soft p-4"><p className="flex items-center gap-2 font-semibold"><WarningCircle size={22} className="text-warning" /> Las notificaciones están desactivadas</p><p className="mt-2 text-sm text-muted">Puedes activarlas desde la configuración del navegador o dispositivo.</p></div>;
  return <div>{state === "error" && <p className="mb-3 text-sm text-accent-strong">No pudimos activar las notificaciones. Revisa tu conexión.</p>}<button type="button" onClick={enable} className="pressable flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 font-bold text-on-accent hover:bg-accent-strong"><Bell size={21} weight="fill" /> Activar notificaciones</button></div>;
}
