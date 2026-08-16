import { z } from "zod";
import { APPLICATION_CURRENCY } from "@/features/payments/application-currency";

const profileSchema = z.object({
  publicName: z.string().trim().min(1).max(80),
  username: z.string(),
  bio: z.string().trim().max(180),
  country: z.string().regex(/^[A-Z]{2}$/),
  locale: z.enum(["es", "en"]).default("es"),
}).transform((profile) => ({ ...profile, currency: APPLICATION_CURRENCY }));

export function parseProfileFormData(formData: FormData) {
  return profileSchema.safeParse({
    publicName: formData.get("publicName"),
    username: formData.get("username"),
    bio: formData.get("bio"),
    country: formData.get("country"),
    locale: formData.get("locale") ?? "es",
  });
}
