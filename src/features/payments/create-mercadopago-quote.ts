import { z } from "zod";
import type { Currency } from "./types";
import type { PaymentAccountLookup, TipRepository } from "./create-tip";
import { convertUsdMinorToLocalMinor } from "./mercadopago-exchange-rate";
import { createPaymentQuote } from "@/lib/security/payment-quote";

const schema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(30),
  amountUsdMinor: z.number().int().min(100).max(1_000_000),
});

type Dependencies = {
  creators: Pick<TipRepository, "findCreatorByUsername">;
  paymentAccounts: PaymentAccountLookup;
  credentials: { findByAccountId(accountId: string, country?: string): Promise<{ accessToken: string } | null> };
  getRate(input: { accessToken: string; from: "USD"; to: Currency }): Promise<{ rate: number; quotedAt: string }>;
  signingSecret: string;
  now?: Date;
};

export async function createMercadoPagoQuote(input: unknown, dependencies: Dependencies) {
  const value = schema.parse(input);
  const creator = await dependencies.creators.findCreatorByUsername(value.username);
  if (!creator) throw new Error("creator_not_found");
  const account = await dependencies.paymentAccounts.findConnected(creator.id, "mercadopago");
  if (!account?.country || !account.currency) throw new Error("mercadopago_account_not_connected");
  const credential = await dependencies.credentials.findByAccountId(account.id, account.country);
  if (!credential) throw new Error("mercadopago_credentials_missing");

  const quote = account.currency === "USD"
    ? { rate: 1, quotedAt: (dependencies.now ?? new Date()).toISOString() }
    : await dependencies.getRate({ accessToken: credential.accessToken, from: "USD", to: account.currency });
  const localAmountMinor = convertUsdMinorToLocalMinor(value.amountUsdMinor, quote.rate, account.currency);
  const now = dependencies.now ?? new Date();
  const payload = {
    creatorId: creator.id,
    paymentAccountId: account.id,
    amountUsdMinor: value.amountUsdMinor,
    localAmountMinor,
    currency: account.currency,
    rate: quote.rate,
    quotedAt: quote.quotedAt,
    expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
    source: "mercadopago" as const,
  };
  return { ...payload, quoteToken: createPaymentQuote(payload, dependencies.signingSecret) };
}
