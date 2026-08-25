import { Bell } from "@phosphor-icons/react/dist/ssr";
import { getPublicEnv } from "@/lib/env/public";
import { PushSetup } from "@/components/push/push-setup";

export default function NotificationSettingsPage() {
  return <div className="mx-auto max-w-xl"><Bell size={32} className="text-accent-strong" weight="fill" /><h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Notificaciones</h1><p className="mt-2 text-muted">Te avisaremos inmediatamente cuando recibas un tip confirmado.</p><div className="mt-7 rounded-2xl border border-border bg-surface p-5"><PushSetup vapidPublicKey={getPublicEnv().NEXT_PUBLIC_VAPID_PUBLIC_KEY} /></div></div>;
}
