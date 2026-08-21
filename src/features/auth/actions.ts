"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getGoogleCallbackUrl, sanitizeInternalPath } from "@/features/auth/oauth";
import { getPublicEnv } from "@/lib/env/public";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

function errorRedirect(path: string, code: string): never {
  redirect(`${path}?error=${encodeURIComponent(code)}`);
}

export async function signup(formData: FormData) {
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) errorRedirect("/signup", "invalid_credentials");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { locale: "es" } } });
  if (error) errorRedirect("/signup", "signup_failed");
  redirect(data.session ? "/onboarding" : "/login?message=check_email");
}

export async function login(formData: FormData) {
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) errorRedirect("/login", "invalid_credentials");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) errorRedirect("/login", "login_failed");
  redirect(sanitizeInternalPath(String(formData.get("next") ?? "/dashboard")));
}

export async function signInWithGoogle() {
  const supabase = await createServerSupabaseClient();
  const callbackUrl = getGoogleCallbackUrl(getPublicEnv().NEXT_PUBLIC_APP_URL);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl },
  });
  if (error || !data.url) errorRedirect("/login", "oauth_failed");
  redirect(data.url);
}

export async function logout() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/");
}
