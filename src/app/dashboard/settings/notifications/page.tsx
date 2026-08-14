import { Bell } from "@phosphor-icons/react/dist/ssr";
import { getPublicEnv } from "@/lib/env/public";
import { PushSetup } from "@/components/push/push-setup";

export default function NotificationSettingsPage() {
  return <div className="mx-auto max-w-xl"><Bell size={32} className="text-accent" weight="fill" /><h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Notificaciones</h1><p className="mt-2 text-muted">Entérate cuando recibas un tip o cambie un retiro.</p><div className="mt-7 rounded-2xl border border-border bg-surface p-5"><div className="flex justify-between gap-4"><span className="font-semibold">Tips recibidos</span><span className="text-success">ON</span></div><div className="mt-4 flex justify-between gap-4"><span className="font-semibold">Retiros</span><span className="text-success">ON</span></div></div><div className="mt-4 rounded-2xl border border-border bg-surface p-5"><PushSetup vapidPublicKey={getPublicEnv().NEXT_PUBLIC_VAPID_PUBLIC_KEY} /></div></div>;
}
