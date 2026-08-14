import { z } from "zod";

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default("fake-service-role-key-replace-me"),
  PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(300),
  PAYMENT_PROVIDER: z.enum(["mock", "nuvei", "ebanx", "dlocal"]).default("mock"),
  MOCK_WEBHOOK_SECRET: z.string().min(16).default("fake-mock-webhook-secret-change-me"),
  VAPID_PRIVATE_KEY: z.string().min(1).default("fake-vapid-private-key-replace-me"),
  VAPID_SUBJECT: z.string().min(1).default("mailto:admin@tipme.pro"),
});

export type ServerEnv = z.infer<typeof schema>;

export function getServerEnv(): ServerEnv {
  return schema.parse(process.env);
}
