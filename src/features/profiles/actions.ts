"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { validateUsername } from "./username";
import { parseProfileFormData } from "./profile-input";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env/server";
import { logSupabaseError } from "@/lib/logging/supabase-error";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createWhopApi } from "@/features/payments/whop-provider";
import { verifyWhopCompany } from "@/features/payments/whop-account";

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
  const update = {
    public_name: parsed.data.publicName, username: username.value, bio: parsed.data.bio || null,
    preferred_currency: parsed.data.currency, locale: parsed.data.locale,
    ...(env.PAYMENT_PROVIDER === "whop" ? { onboarding_completed: true } : {}),
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  };
  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) {
    logSupabaseError("saveOnboardingProfile", error, user.id);
    redirect(`/onboarding?step=1&error=${error.code === "23505" ? "username_taken" : "save_profile"}`);
  }
  redirect(env.PAYMENT_PROVIDER === "whop" ? "/dashboard" : "/onboarding?step=2");
}

export async function connectWhopCompany(formData: FormData) {
  const { user } = await authenticatedUser();
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER !== "whop") redirect("/dashboard/settings/payments?error=provider_unavailable");

  let company;
  try {
    company = await verifyWhopCompany(String(formData.get("companyId") ?? ""), createWhopApi(env.WHOP_API_KEY));
  } catch (error) {
    const code = error instanceof Error ? error.message : "whop_connection_failed";
    redirect(`/dashboard/settings/payments?error=${encodeURIComponent(code)}`);
  }

  const { error } = await createAdminSupabaseClient().from("payment_accounts").upsert({
    creator_id: user.id,
    provider: "whop",
    provider_merchant_id: company.id,
    status: "connected",
    onboarding_completed: true,
    email_confirmed: true,
    payments_receivable: true,
    card_payments_enabled: true,
    connected_at: new Date().toISOString(),
  }, { onConflict: "creator_id,provider" });
  if (error) {
    logSupabaseError("connectWhopCompany", error, user.id);
    redirect(`/dashboard/settings/payments?error=${error.code === "23505" ? "whop_company_taken" : "save_whop_company"}`);
  }
  redirect("/dashboard/settings/payments?connected=1");
}

// dLocal Go no expone API para crear la colaboración: la creadora acepta la invitación
// en su panel y copia de ahí el split code que autoriza el reparto de cada cobro.
const SPLIT_CODE_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

export async function saveDLocalGoSplitCode(formData: FormData) {
  const splitCode = String(formData.get("splitCode") ?? "").trim();
  if (!SPLIT_CODE_PATTERN.test(splitCode)) redirect("/onboarding?step=2&error=invalid_split_code");
  const { supabase, user } = await authenticatedUser();

  const { error } = await supabase.from("payment_accounts").upsert({
    creator_id: user.id,
    provider: "dlocalgo",
    provider_merchant_id: splitCode,
    status: "connected",
    onboarding_completed: true,
    email_confirmed: true,
    payments_receivable: true,
    card_payments_enabled: true,
    connected_at: new Date().toISOString(),
  }, { onConflict: "creator_id,provider" });
  if (error) {
    logSupabaseError("saveDLocalGoSplitCode", error, user.id);
    // La unicidad (provider, provider_merchant_id) impide reusar el split code de otra creadora.
    redirect(`/onboarding?step=2&error=${error.code === "23505" ? "split_code_taken" : "save_split_code"}`);
  }
  redirect("/onboarding?step=3");
}

export async function completeOnboarding() {
  const { supabase, user } = await authenticatedUser();
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER === "mercadopago") {
    const { data: account } = await supabase.from("payment_accounts").select("id").eq("creator_id", user.id).eq("provider", "mercadopago").eq("status", "connected").eq("onboarding_completed", true).limit(1).maybeSingle();
    if (!account) redirect("/onboarding?step=2&error=mercadopago_required");
  }
  if (env.PAYMENT_PROVIDER === "dlocalgo") {
    const { data: account } = await supabase.from("payment_accounts").select("id").eq("creator_id", user.id).eq("provider", "dlocalgo").eq("status", "connected").limit(1).maybeSingle();
    if (!account) redirect("/onboarding?step=2&error=dlocalgo_required");
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
    public_name: parsed.data.publicName, username: username.value, bio: parsed.data.bio || null,
    preferred_currency: parsed.data.currency, locale: parsed.data.locale, ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  }).eq("id", user.id);
  if (error) redirect(`/dashboard/settings?error=${error.code === "23505" ? "username_taken" : "save_profile"}`);
  redirect("/dashboard/settings?success=saved");
}
