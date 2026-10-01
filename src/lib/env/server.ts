import { z } from "zod";

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default("fake-service-role-key-replace-me"),
  PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(0),
  PAYMENT_PROVIDER: z.literal("paypal").default("paypal"),
  PAYPAL_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),
  PAYPAL_JS_SDK_VERSION: z.enum(["v5", "v6"]).default("v6"),
  PAYPAL_MERCHANT_COUNTRY: z.string().regex(/^[A-Z]{2}$/).default("PE"),
  PAYPAL_FLOW: z.enum(["platform_payouts", "multiparty"]).default("platform_payouts"),
  PAYPAL_SANDBOX_SINGLE_MERCHANT: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  PAYPAL_PAYOUT_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(200),
  PAYPAL_PAYOUT_FEE_CAP_MINOR: z.coerce.number().int().nonnegative().default(100),
  PAYPAL_CHECKOUT_FEE_BPS: z.coerce.number().int().min(0).max(9_999).default(540),
  PAYPAL_CHECKOUT_FIXED_FEE_MINOR: z.coerce.number().int().nonnegative().default(30),
  PAYOUT_HOLD_MINUTES: z.coerce.number().int().nonnegative().default(0),
  PAYPAL_SANDBOX_PAYOUT_RECIPIENT_ID: z.string().trim().min(1).optional(),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().min(1).default("fake-paypal-client-id-replace-me"),
  PAYPAL_CLIENT_SECRET: z.string().min(1).default("fake-paypal-client-secret-replace-me"),
  PAYPAL_WEBHOOK_ID: z.string().min(1).default("fake-paypal-webhook-id-replace-me"),
  PAYPAL_PARTNER_MERCHANT_ID: z.string().min(1).default("fake-paypal-partner-merchant-id-replace-me"),
  PAYPAL_PARTNER_ATTRIBUTION_ID: z.string().default(""),
  RECEIPT_SIGNING_SECRET: z.string().min(16).default("fake-receipt-signing-secret-change-me"),
  VAPID_PRIVATE_KEY: z.string().min(1).default("fake-vapid-private-key-replace-me"),
  VAPID_SUBJECT: z.string().min(1).default("mailto:admin@tipme.pro"),
}).superRefine((env, context) => {
  if (env.PAYPAL_SANDBOX_SINGLE_MERCHANT && env.PAYPAL_ENVIRONMENT !== "sandbox") {
    context.addIssue({ code: "custom", path: ["PAYPAL_SANDBOX_SINGLE_MERCHANT"], message: "Single-merchant PayPal mode is Sandbox-only" });
  }
});

export type ServerEnv = z.infer<typeof schema>;

export function getServerEnv(): ServerEnv {
  // En un .env, `FOO=` significa "sin configurar", pero llega como "" y no como
  // undefined: los .default() del esquema no se aplican y los .min() fallan.
  // Se descartan los valores vacíos para que blanco y ausente sean lo mismo.
  const configured = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined && value.trim() !== ""),
  );
  return schema.parse(configured);
}
