import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default("https://fake-project.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).default("fake-anon-key-replace-me"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).default("fake-vapid-public-key-replace-me"),
});

export type PublicEnv = z.infer<typeof schema>;

export function getPublicEnv(): PublicEnv {
  return schema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });
}

