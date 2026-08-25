import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default("https://fake-project.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).default("fake-anon-key-replace-me"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).default("fake-vapid-public-key-replace-me"),
});

export type PublicEnv = z.infer<typeof schema>;

// Igual que en el esquema de servidor: `FOO=` en un .env llega como "" y anula
// el .default(), así que un valor en blanco se trata como ausente.
function configured(value: string | undefined) {
  return value !== undefined && value.trim() !== "" ? value : undefined;
}

export function getPublicEnv(): PublicEnv {
  return schema.parse({
    NEXT_PUBLIC_APP_URL: configured(process.env.NEXT_PUBLIC_APP_URL),
    NEXT_PUBLIC_SUPABASE_URL: configured(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: configured(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: configured(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
  });
}

