import { z } from "zod";
import { APPLICATION_CURRENCY } from "@/features/payments/application-currency";
import type { Currency } from "@/features/payments/types";
import type { PaymentProvider, PayoutStatus } from "@/features/payments/provider";

export type PayoutAccount = {
  id: string;
  creatorId: string;
  providerAccountId: string;
  provider: string;
  verified: boolean;
  country: string;
  bankName: string | null;
  last4: string | null;
};

export interface PayoutRepository {
  getAccount(accountId: string, creatorId: string): Promise<PayoutAccount | null>;
  getAvailableBalance(creatorId: string, currency: Currency): Promise<number>;
  reservePayout(input: { creatorId: string; accountId: string; amountMinor: number; currency: Currency; idempotencyKey: string }): Promise<{ id: string }>;
  attachProviderPayout(payoutId: string, providerPayoutId: string, status: PayoutStatus): Promise<void>;
  transitionFromProvider(event: PayoutProviderEvent): Promise<{ newlyProcessed: boolean; creatorId?: string; payoutId?: string; amountMinor?: number; currency?: Currency; status?: PayoutStatus }>;
}

const requestSchema = z.object({
  creatorId: z.string().min(1), accountId: z.string().min(1), amountMinor: z.number().int().positive(),
  currency: z.literal(APPLICATION_CURRENCY), idempotencyKey: z.string().min(8).max(160),
});

type PayoutRequestInput = {
  creatorId: string;
  accountId: string;
  amountMinor: number;
  currency: Currency;
  idempotencyKey: string;
};

export async function requestPayout(input: PayoutRequestInput, dependencies: { repository: PayoutRepository; provider: PaymentProvider }) {
  const value = requestSchema.parse(input);
  const account = await dependencies.repository.getAccount(value.accountId, value.creatorId);
  if (!account || !account.verified) throw new Error("payout_account_not_verified");
  const available = await dependencies.repository.getAvailableBalance(value.creatorId, value.currency);
  if (available < value.amountMinor) throw new Error("insufficient_balance");
  const payout = await dependencies.repository.reservePayout(value);
  const providerResult = await dependencies.provider.createPayout({
    payoutId: payout.id, amountMinor: value.amountMinor, currency: value.currency,
    providerAccountId: account.providerAccountId, idempotencyKey: value.idempotencyKey,
  });
  await dependencies.repository.attachProviderPayout(payout.id, providerResult.providerPayoutId, providerResult.status);
  return { payoutId: payout.id, providerPayoutId: providerResult.providerPayoutId, status: providerResult.status };
}

export type PayoutProviderEvent = {
  provider: string;
  eventId: string;
  providerPayoutId: string;
  status: Extract<PayoutStatus, "processing" | "completed" | "failed">;
  payloadDigest: string;
  failureCode?: string | null;
};

export async function processPayoutEvent(event: PayoutProviderEvent, dependencies: { repository: PayoutRepository; notify(payload: { creatorId: string; payoutId: string; title: string; body: string; status: PayoutStatus; amountMinor?: number; currency?: Currency }): Promise<unknown> }) {
  const result = await dependencies.repository.transitionFromProvider(event);
  if (!result.newlyProcessed || event.status === "processing" || !result.creatorId || !result.payoutId) return result;
  try {
    await dependencies.notify({
      creatorId: result.creatorId,
      payoutId: result.payoutId,
      status: event.status,
      amountMinor: result.amountMinor,
      currency: result.currency,
      title: event.status === "completed" ? "Retiro completado" : "No pudimos completar tu retiro",
      body: event.status === "completed" ? "El dinero fue enviado a tu método de retiro." : "Entra a TipMe para revisar el problema.",
    });
  } catch {
    return { ...result, pushFailed: true };
  }
  return result;
}
