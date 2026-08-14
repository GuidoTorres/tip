import { Bell, CheckCircle, HandCoins, Heart } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { markNotificationRead } from "@/features/notifications/actions";
import { formatDistanceToNow } from "@/lib/time";

export default async function NotificationsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("notifications").select("id,type,title,body,related_tip_id,related_payout_id,read_at,created_at").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(40);
  return <div className="mx-auto max-w-2xl"><div className="flex items-center gap-3"><Bell size={30} className="text-accent" weight="fill" /><h1 className="text-3xl font-semibold tracking-[-0.04em]">Notificaciones</h1></div>{!data?.length ? <div className="mt-7 rounded-2xl border border-dashed border-border p-8 text-center text-muted">No tienes notificaciones todavía.</div> : <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-surface">{data.map((item, index) => { const Icon = item.type === "tip_confirmed" ? Heart : item.type === "payout_completed" ? CheckCircle : HandCoins; return <form key={item.id} action={markNotificationRead} className={index ? "border-t border-border" : ""}><input type="hidden" name="notificationId" value={item.id} /><button className={`flex w-full gap-4 p-4 text-left hover:bg-surface-soft ${item.read_at ? "opacity-65" : ""}`}><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-soft text-accent"><Icon size={22} weight="fill" /></span><span className="min-w-0 flex-1"><span className="font-semibold">{item.title}</span><span className="mt-1 block text-sm text-muted">{item.body}</span><span className="mt-2 block text-xs text-muted">{formatDistanceToNow(item.created_at)}</span></span>{!item.read_at && <span className="mt-2 size-2 rounded-full bg-accent" aria-label="Sin leer" />}</button></form>; })}</div>}</div>;
}

