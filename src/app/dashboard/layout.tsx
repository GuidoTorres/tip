import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DesktopNav, MobileNav } from "@/components/dashboard/mobile-nav";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { DashboardHeaderActions } from "@/components/dashboard/header-actions";
import { getServerEnv } from "@/lib/env/server";
import { getPublicEnv } from "@/lib/env/public";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("onboarding_completed").eq("id", user.id).single();
  if (!profile?.onboarding_completed) redirect("/onboarding");
  const serverEnv = getServerEnv();
  const showPayouts = serverEnv.PAYMENT_PROVIDER !== "mercadopago" && serverEnv.PAYMENT_PROVIDER !== "paypal";
  const vapidPublicKey = getPublicEnv().NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return <div className="min-h-[100dvh] pb-24 md:pb-8"><ServiceWorkerRegister /><RealtimeRefresh creatorId={user.id} /><header className="sticky top-0 z-10 border-b border-border bg-background/92 backdrop-blur"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6"><Link href="/dashboard" className="text-xl font-bold tracking-[-0.04em]">TipMe<span className="text-accent">.</span></Link><DesktopNav showPayouts={showPayouts} /><DashboardHeaderActions vapidPublicKey={vapidPublicKey} /></div></header><main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10">{children}</main><MobileNav showPayouts={showPayouts} /></div>;
}
