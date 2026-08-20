"use client";

import { SignOut } from "@phosphor-icons/react";
import { PushSetup } from "@/components/push/push-setup";
import { logout } from "@/features/auth/actions";

export function DashboardHeaderActions({ vapidPublicKey }: { vapidPublicKey: string }) {
  return <div className="flex items-center gap-1">
    <PushSetup vapidPublicKey={vapidPublicKey} header />
    <form action={logout} onSubmit={(event) => {
      if (!window.confirm("¿Deseas cerrar sesión?")) event.preventDefault();
    }}>
      <button type="submit" aria-label="Cerrar sesión" title="Cerrar sesión" className="pressable grid size-11 place-items-center rounded-full text-muted hover:bg-surface-soft hover:text-foreground"><SignOut size={21} weight="bold" /></button>
    </form>
  </div>;
}
