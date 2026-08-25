import { NextResponse } from "next/server";
import { validateUsername } from "@/features/profiles/username";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`username-availability:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const requested = new URL(request.url).searchParams.get("username") ?? "";
  const username = validateUsername(requested);
  if (!username.ok) {
    return NextResponse.json({ error: `${username.error}_username` }, { status: 400 });
  }

  const { data: owner, error } = await createAdminSupabaseClient()
    .from("profiles")
    .select("id")
    .eq("username", username.value)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "availability_unavailable" }, { status: 503 });

  return NextResponse.json(
    { username: username.value, available: !owner || owner.id === user.id },
    { headers: { "cache-control": "private, no-store" } },
  );
}
