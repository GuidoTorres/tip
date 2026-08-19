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

export function PushSetup({ vapidPublicKey, compact = false }: { vapidPublicKey: string; compact?: boolean }) {
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

  if (state === "checking") return <div className={`${compact ? "h-12 rounded-xl" : "h-32 rounded-2xl"} animate-pulse bg-surface-soft`} aria-label="Comprobando notificaciones" />;
  if (state === "unsupported") return compact
    ? <p className="flex items-center gap-2 text-sm font-semibold text-muted"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-soft"><WarningCircle size={21} /></span><span>Notificaciones no disponibles</span></p>
    : <p className="rounded-2xl bg-surface-soft p-4 text-sm text-muted">Este navegador no admite Web Push. TipMe seguirá funcionando normalmente.</p>;
  if (state === "install-ios") return compact
    ? <p className="flex items-center gap-2 text-sm font-semibold text-muted"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-soft text-accent"><ShareNetwork size={21} /></span><span>Añade TipMe a inicio para activarlas</span></p>
    : <div className="rounded-2xl bg-surface-soft p-5"><ShareNetwork size={26} className="text-accent" /><h3 className="mt-3 font-semibold">Recibe tus tips al instante</h3><ol className="mt-3 space-y-2 text-sm text-muted"><li>1. Pulsa Compartir.</li><li>2. Selecciona “Añadir a pantalla de inicio”.</li><li>3. Abre TipMe desde el icono.</li><li>4. Activa las notificaciones.</li></ol></div>;
  if (state === "active") return compact
    ? <p role="status" aria-label="Notificaciones activadas" title="Notificaciones activadas" className="grid size-11 place-items-center rounded-full bg-accent text-on-accent"><Bell size={21} weight="fill" /></p>
    : <p className="flex items-center gap-2 rounded-2xl bg-surface-soft p-4 font-semibold text-success"><CheckCircle size={22} weight="fill" /> Notificaciones activadas</p>;
  if (state === "denied") return compact
    ? <p className="flex items-center gap-2 text-sm font-semibold text-muted"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-soft text-warning"><WarningCircle size={21} /></span><span>Notificaciones bloqueadas</span></p>
    : <div className="rounded-2xl bg-surface-soft p-4"><p className="flex items-center gap-2 font-semibold"><WarningCircle size={22} className="text-warning" /> Las notificaciones están desactivadas</p><p className="mt-2 text-sm text-muted">Puedes activarlas desde la configuración del navegador o dispositivo.</p></div>;
  if (compact) return <div><button type="button" aria-label="Activar notificaciones" title="Activar notificaciones" onClick={enable} className="pressable grid size-11 place-items-center rounded-full border border-border bg-surface-soft text-muted"><Bell size={21} /></button>{state === "error" && <p className="mt-1 text-xs text-accent-strong">No pudimos activarlas. Inténtalo otra vez.</p>}</div>;
  return <div>{state === "error" && <p className="mb-3 text-sm text-accent-strong">No pudimos activar las notificaciones. Revisa tu conexión.</p>}<button type="button" onClick={enable} className="pressable flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 font-bold text-on-accent hover:bg-accent-strong"><Bell size={21} weight="fill" /> Activar notificaciones</button></div>;
}
