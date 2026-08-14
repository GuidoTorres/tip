"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function markNotificationRead(formData: FormData) {
  const id = String(formData.get("notificationId") ?? "");
  if (!id) return;
  const supabase = await createServerSupabaseClient();
  await supabase.rpc("mark_notification_read", { p_notification_id: id });
  revalidatePath("/dashboard/notifications");
}

