import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DesktopNav, MobileNav } from "@/components/dashboard/mobile-nav";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { logout } from "@/features/auth/actions";
import { getServerEnv } from "@/lib/env/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("onboarding_completed").eq("id", user.id).single();
  if (!profile?.onboarding_completed) redirect("/onboarding");
  const showPayouts = getServerEnv().PAYMENT_PROVIDER !== "paypal";
  return <div className="min-h-[100dvh] pb-24 md:pb-8"><ServiceWorkerRegister /><RealtimeRefresh creatorId={user.id} /><header className="sticky top-0 z-10 border-b border-border bg-background/92 backdrop-blur"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6"><Link href="/dashboard" className="text-xl font-bold tracking-[-0.04em]">TipMe<span className="text-accent">.</span></Link><DesktopNav showPayouts={showPayouts} /><form action={logout}><button className="rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-foreground">Salir</button></form></div></header><main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10">{children}</main><MobileNav showPayouts={showPayouts} /></div>;
}
