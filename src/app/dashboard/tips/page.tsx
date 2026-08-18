import { redirect } from "next/navigation";
import { TipList, type RecentTip } from "@/components/dashboard/recent-tips";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function TipsHistoryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: tips } = await supabase.from("tips")
    .select("id,payer_name,message,anonymous,amount_minor,currency,status,created_at")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return <div className="mx-auto max-w-2xl"><h1 className="text-3xl font-semibold tracking-[-0.04em]">Historial de tips</h1><p className="mt-2 text-muted">Tus 50 tips más recientes.</p><div className="mt-6"><TipList tips={(tips ?? []) as RecentTip[]} /></div></div>;
}
