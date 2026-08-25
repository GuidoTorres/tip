"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function RealtimeRefresh({ creatorId }: { creatorId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase.channel(`creator:${creatorId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tips", filter: `creator_id=eq.${creatorId}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `creator_id=eq.${creatorId}` }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [creatorId, router]);
  return null;
}

