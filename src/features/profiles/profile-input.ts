import { z } from "zod";
import { APPLICATION_CURRENCY } from "@/features/payments/application-currency";
import { CONTENT_CATEGORIES } from "@/features/compliance/creator-policy";

const profileSchema = z.object({
  publicName: z.string().trim().min(1).max(80),
  username: z.string(),
  bio: z.string().trim().max(180),
  socialUrl: z.string().trim().min(1).max(2048).refine((value) => {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }),
  contentCategory: z.enum(CONTENT_CATEGORIES),
  creatorPolicyAccepted: z.literal("on"),
  locale: z.enum(["es", "en"]).default("es"),
}).transform((profile) => ({ ...profile, currency: APPLICATION_CURRENCY }));

export function parseProfileFormData(formData: FormData) {
  return profileSchema.safeParse({
    publicName: formData.get("publicName"),
    username: formData.get("username"),
    bio: formData.get("bio"),
    socialUrl: formData.get("socialUrl"),
    contentCategory: formData.get("contentCategory"),
    creatorPolicyAccepted: formData.get("creatorPolicyAccepted"),
    locale: formData.get("locale") ?? "es",
  });
}
