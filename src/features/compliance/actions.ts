"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/admin/guard";
import { reviewCreatorPolicy } from "@/features/compliance/creator-review";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function reviewCreatorPolicyAction(formData: FormData) {
  const { user } = await requireAdmin();
  const admin = createAdminSupabaseClient();

  await reviewCreatorPolicy({
    creatorId: String(formData.get("creatorId") ?? ""),
    status: String(formData.get("status") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  }, {
    adminId: user.id,
    repository: {
      async review(decision) {
        const { error } = await admin.rpc("review_creator_policy", {
          requested_creator: decision.creatorId,
          requested_status: decision.status,
          requested_reason: decision.reason,
          requested_admin: decision.adminId,
        });
        if (error) throw new Error("creator_review_failed");
      },
    },
  });

  revalidatePath("/admin/creators");
  revalidatePath("/dashboard");
}
