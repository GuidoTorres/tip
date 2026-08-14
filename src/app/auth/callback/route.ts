import { NextResponse } from "next/server";
import { getOAuthDestination } from "@/features/auth/oauth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", data.user.id)
        .maybeSingle();
      const destination = getOAuthDestination({
        onboardingCompleted: profile?.onboarding_completed === true,
        requestedNext: requestUrl.searchParams.get("next"),
      });
      return NextResponse.redirect(new URL(destination, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=oauth_failed", requestUrl.origin));
}
