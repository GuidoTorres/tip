import { z } from "zod";

const creatorReviewSchema = z.object({
  creatorId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "suspended"]),
  reason: z.string().trim().min(3).max(500),
});

export type CreatorReview = z.infer<typeof creatorReviewSchema> & { adminId: string };

export interface CreatorReviewRepository {
  review(decision: CreatorReview): Promise<void>;
}

export async function reviewCreatorPolicy(
  input: { creatorId: string; status: string; reason: string },
  context: { adminId: string; repository: CreatorReviewRepository },
) {
  const decision = creatorReviewSchema.safeParse(input);
  const adminId = z.string().uuid().safeParse(context.adminId);
  if (!decision.success || !adminId.success) throw new Error("invalid_creator_review");

  await context.repository.review({ ...decision.data, adminId: adminId.data });
}
