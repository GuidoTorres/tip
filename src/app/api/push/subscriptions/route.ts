import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(512) }),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  const { error } = await supabase.from("push_subscriptions").upsert({
    creator_id: user.id, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null, revoked_at: null,
  }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "subscription_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  await supabase.from("push_subscriptions").update({ revoked_at: new Date().toISOString() }).eq("creator_id", user.id).eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}

