"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { validateUsername } from "./username";
import { parseProfileFormData } from "./profile-input";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env/server";
import { logSupabaseError } from "@/lib/logging/supabase-error";
import { CREATOR_POLICY_VERSION } from "@/features/compliance/creator-policy";

async function authenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function saveOnboardingProfile(formData: FormData) {
  const parsed = parseProfileFormData(formData);
  if (!parsed.success) redirect("/onboarding?step=1&error=invalid_profile");
  const username = validateUsername(parsed.data.username);
  if (!username.ok) redirect(`/onboarding?step=1&error=${username.error}_username`);
  const { supabase, user } = await authenticatedUser();

  let avatarUrl: string | undefined;
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (avatar.size > 5_242_880 || !allowed.includes(avatar.type)) redirect("/onboarding?step=1&error=invalid_avatar");
    const extension = avatar.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${user.id}/avatar.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, avatar, { upsert: true, contentType: avatar.type, cacheControl: "3600" });
    if (uploadError) redirect("/onboarding?step=1&error=avatar_upload");
    avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  const env = getServerEnv();
  const profileCompletesOnboarding = env.PAYPAL_FLOW === "platform_payouts";
  const update = {
    public_name: parsed.data.publicName, username: username.value, bio: parsed.data.bio || null, social_url: parsed.data.socialUrl,
    content_category: parsed.data.contentCategory,
    creator_policy_version: CREATOR_POLICY_VERSION,
    creator_policy_accepted_at: new Date().toISOString(),
    preferred_currency: parsed.data.currency, locale: parsed.data.locale,
    ...(profileCompletesOnboarding ? { onboarding_completed: true } : {}),
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  };
  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) {
    logSupabaseError("saveOnboardingProfile", error, user.id);
    redirect(`/onboarding?step=1&error=${error.code === "23505" ? "username_taken" : "save_profile"}`);
  }
  redirect(profileCompletesOnboarding ? "/dashboard" : "/onboarding?step=2");
}

export async function savePayPalPayoutEmail(formData: FormData) {
  const email = z.string().trim().toLowerCase().email().max(254).safeParse(formData.get("paypalEmail"));
  const returnTo = formData.get("returnTo") === "/dashboard/payouts" ? "/dashboard/payouts" : "/onboarding?step=3";
  if (!email.success) redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=invalid_paypal_email`);
  const confirmation = String(formData.get("paypalEmailConfirmation") ?? "").trim().toLowerCase();
  if (confirmation !== email.data || formData.get("paypalEmailConfirmed") !== "on") {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=confirm_paypal_email`);
  }
  const { supabase } = await authenticatedUser();
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER !== "paypal" || env.PAYPAL_FLOW !== "platform_payouts") {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=provider_unavailable`);
  }
  const { error } = await supabase.rpc("set_my_paypal_payout_email", { p_email: email.data });
  if (error) redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=save_paypal_email`);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/[username]", "page");
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}success=paypal_saved`);
}

export async function completeOnboarding() {
  const { supabase, user } = await authenticatedUser();
  const env = getServerEnv();
  if (env.PAYPAL_FLOW === "platform_payouts") {
    const { data: account } = await supabase.from("payout_accounts").select("id").eq("creator_id", user.id).eq("provider", "paypal").in("status", ["pending", "verified"]).limit(1).maybeSingle();
    if (!account) redirect("/onboarding?step=2&error=paypal_required");
  }
  const { error } = await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
  if (error) redirect("/onboarding?step=3&error=finish");
  redirect("/dashboard");
}

export async function deleteAvatar() {
  const { supabase, user } = await authenticatedUser();
  const { data } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).single();
  const marker = "/storage/v1/object/public/avatars/";
  const path = data?.avatar_url?.split(marker)[1];
  if (path) await supabase.storage.from("avatars").remove([decodeURIComponent(path)]);
  await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  revalidatePath("/dashboard/settings");
}

export async function updateSettings(formData: FormData) {
  const parsed = parseProfileFormData(formData);
  if (!parsed.success) redirect("/dashboard/settings?error=invalid_profile");
  const username = validateUsername(parsed.data.username);
  if (!username.ok) redirect(`/dashboard/settings?error=${username.error}_username`);
  const { supabase, user } = await authenticatedUser();
  let avatarUrl: string | undefined;
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    if (avatar.size > 5_242_880 || !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(avatar.type)) redirect("/dashboard/settings?error=invalid_avatar");
    const extension = avatar.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${user.id}/avatar.${extension}`;
    const { error } = await supabase.storage.from("avatars").upload(path, avatar, { upsert: true, contentType: avatar.type });
    if (error) redirect("/dashboard/settings?error=avatar_upload");
    avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }
  const { error } = await supabase.from("profiles").update({
    public_name: parsed.data.publicName, username: username.value, bio: parsed.data.bio || null, social_url: parsed.data.socialUrl,
    content_category: parsed.data.contentCategory,
    creator_policy_version: CREATOR_POLICY_VERSION,
    creator_policy_accepted_at: new Date().toISOString(),
    preferred_currency: parsed.data.currency, locale: parsed.data.locale, ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  }).eq("id", user.id);
  if (error) redirect(`/dashboard/settings?error=${error.code === "23505" ? "username_taken" : "save_profile"}`);
  redirect("/dashboard/settings?success=saved");
}
