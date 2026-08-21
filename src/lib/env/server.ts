import { z } from "zod";

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default("fake-service-role-key-replace-me"),
  PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(0),
  PAYMENT_PROVIDER: z.enum(["mock", "paypal", "mercadopago", "nuvei", "ebanx", "dlocal"]).default("mock"),
  MOCK_WEBHOOK_SECRET: z.string().min(16).default("fake-mock-webhook-secret-change-me"),
  RECEIPT_SIGNING_SECRET: z.string().min(16).default("fake-receipt-signing-secret-change-me"),
  PAYPAL_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),
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
  PAYMENT_TOKEN_ENCRYPTION_KEY: z.string().min(1).default("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
  MERCADOPAGO_MX_CLIENT_ID: z.string().min(1).default("fake-mp-mx-client-id-replace-me"),
  MERCADOPAGO_MX_CLIENT_SECRET: z.string().min(1).default("fake-mp-mx-client-secret-replace-me"),
  NEXT_PUBLIC_MERCADOPAGO_MX_PUBLIC_KEY: z.string().min(1).default("fake-mp-mx-public-key-replace-me"),
  MERCADOPAGO_MX_WEBHOOK_SECRET: z.string().min(1).default("fake-mp-mx-webhook-secret-replace-me"),
  MERCADOPAGO_CO_CLIENT_ID: z.string().min(1).default("fake-mp-co-client-id-replace-me"),
  MERCADOPAGO_CO_CLIENT_SECRET: z.string().min(1).default("fake-mp-co-client-secret-replace-me"),
  NEXT_PUBLIC_MERCADOPAGO_CO_PUBLIC_KEY: z.string().min(1).default("fake-mp-co-public-key-replace-me"),
  MERCADOPAGO_CO_WEBHOOK_SECRET: z.string().min(1).default("fake-mp-co-webhook-secret-replace-me"),
  MERCADOPAGO_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),
  VAPID_PRIVATE_KEY: z.string().min(1).default("fake-vapid-private-key-replace-me"),
  VAPID_SUBJECT: z.string().min(1).default("mailto:admin@tipme.pro"),
}).superRefine((env, context) => {
  if (env.PAYPAL_SANDBOX_SINGLE_MERCHANT && env.PAYPAL_ENVIRONMENT !== "sandbox") {
    context.addIssue({ code: "custom", path: ["PAYPAL_SANDBOX_SINGLE_MERCHANT"], message: "Single-merchant PayPal mode is Sandbox-only" });
  }
  if (env.PAYMENT_PROVIDER === "mercadopago") {
    let encryptionKeyValid = false;
    try {
      const key = Buffer.from(env.PAYMENT_TOKEN_ENCRYPTION_KEY, "base64");
      encryptionKeyValid = key.length === 32 && key.some((byte) => byte !== 0);
    } catch { encryptionKeyValid = false; }
    if (!encryptionKeyValid) context.addIssue({ code: "custom", path: ["PAYMENT_TOKEN_ENCRYPTION_KEY"], message: "Use a random base64-encoded 32-byte key" });
  }
});

export type ServerEnv = z.infer<typeof schema>;

export function getServerEnv(): ServerEnv {
  return schema.parse(process.env);
}
