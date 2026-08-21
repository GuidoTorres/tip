import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { supportedCurrencies } from "@/features/payments/types";

const quoteSchema = z.object({
  creatorId: z.string().min(1),
  paymentAccountId: z.string().min(1),
  amountUsdMinor: z.number().int().positive(),
  localAmountMinor: z.number().int().positive(),
  currency: z.enum(supportedCurrencies),
  rate: z.number().positive().finite(),
  quotedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  source: z.literal("mercadopago"),
});

export type PaymentQuotePayload = z.infer<typeof quoteSchema>;

function sign(body: string, secret: string) {
  return createHmac("sha256", secret).update(`tipme-payment-quote:v1:${body}`).digest("base64url");
}

export function createPaymentQuote(payload: PaymentQuotePayload, secret: string) {
  const valid = quoteSchema.parse(payload);
  const body = Buffer.from(JSON.stringify(valid), "utf8").toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifyPaymentQuote(token: string, secret: string, now = new Date()): PaymentQuotePayload {
  const [body, suppliedSignature, extra] = token.split(".");
  if (!body || !suppliedSignature || extra) throw new Error("payment_quote_invalid");
  const expectedSignature = sign(body, secret);
  const supplied = Buffer.from(suppliedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error("payment_quote_invalid");
  let value: unknown;
  try { value = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { throw new Error("payment_quote_invalid"); }
  const parsed = quoteSchema.safeParse(value);
  if (!parsed.success) throw new Error("payment_quote_invalid");
  if (Date.parse(parsed.data.expiresAt) <= now.getTime()) throw new Error("payment_quote_expired");
  return parsed.data;
}
