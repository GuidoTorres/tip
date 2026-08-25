import { z } from "zod";
import { APPLICATION_CURRENCY } from "@/features/payments/application-currency";
import type { Currency } from "@/features/payments/types";
import type { PaymentProvider, PayoutStatus } from "@/features/payments/provider";
import { quotePayoutFromDebit } from "@/features/ledger/money";

export type PayoutAccount = {
  id: string;
  creatorId: string;
  providerAccountId: string;
  provider: string;
  verified: boolean;
  status: "not_started" | "pending" | "verified" | "rejected";
  country: string;
  bankName: string | null;
  last4: string | null;
};

export interface PayoutRepository {
  getAccount(accountId: string, creatorId: string): Promise<PayoutAccount | null>;
  getAvailableBalance(creatorId: string, currency: Currency): Promise<number>;
  reservePayout(input: { creatorId: string; accountId: string; amountMinor: number; recipientAmountMinor: number; estimatedFeeMinor: number; currency: Currency; idempotencyKey: string; platformPayouts: boolean }): Promise<{ id: string }>;
  attachProviderPayout(payoutId: string, providerPayoutId: string, status: PayoutStatus, platformPayouts: boolean): Promise<void>;
  failSubmission(payoutId: string, failureCode: string): Promise<void>;
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

type RequestPayoutDependencies = {
  repository: PayoutRepository;
  provider: PaymentProvider;
  platformPayouts?: boolean;
  payoutFeeBps?: number;
  payoutFeeCapMinor?: number;
  payoutRecipientOverride?: { recipientType: "PAYPAL_ID"; receiver: string };
};

function isDefinitiveProviderRejection(error: unknown) {
  return typeof error === "object" && error !== null && "retryable" in error && error.retryable === false;
}

function providerStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
    ? error.status
    : null;
}

export class PayoutReconciliationRequiredError extends Error {
  constructor(
    readonly payoutId: string,
    readonly stage: "submission" | "attachment" | "release",
    readonly providerStatus: number | null,
    readonly providerBatchId: string | null = null,
  ) {
    super("payout_reconciliation_required");
    this.name = "PayoutReconciliationRequiredError";
  }
}

export async function requestPayout(input: PayoutRequestInput, dependencies: RequestPayoutDependencies) {
  const value = requestSchema.parse(input);
  // Los proveedores con split no implementan payouts: el dinero nunca pasó por TipMe.
  // Se verifica antes de reservar nada para no dejar un payout huérfano en la base.
  const createPayout = dependencies.provider.createPayout?.bind(dependencies.provider);
  if (!createPayout) throw new Error("provider_does_not_support_payouts");
  const account = await dependencies.repository.getAccount(value.accountId, value.creatorId);
  const platformPayouts = dependencies.platformPayouts ?? false;
  const accountAllowed = platformPayouts
    ? account?.provider === "paypal" && (account.status === "pending" || account.status === "verified")
    : account?.verified;
  if (!account || !accountAllowed) throw new Error("payout_account_not_verified");
  const available = await dependencies.repository.getAvailableBalance(value.creatorId, value.currency);
  if (available < value.amountMinor) throw new Error("insufficient_balance");
  const quote = platformPayouts
    ? quotePayoutFromDebit(value.amountMinor, dependencies.payoutFeeBps ?? 0, dependencies.payoutFeeCapMinor ?? 0)
    : { totalDebitMinor: value.amountMinor, recipientAmountMinor: value.amountMinor, estimatedFeeMinor: 0 };
  const payout = await dependencies.repository.reservePayout({
    ...value,
    amountMinor: quote.totalDebitMinor,
    recipientAmountMinor: quote.recipientAmountMinor,
    estimatedFeeMinor: quote.estimatedFeeMinor,
    platformPayouts,
  });
  const recipient = dependencies.payoutRecipientOverride ?? { recipientType: "EMAIL" as const, receiver: account.providerAccountId };
  let providerResult: Awaited<ReturnType<NonNullable<PaymentProvider["createPayout"]>>>;
  try {
    providerResult = await createPayout({
      payoutId: payout.id,
      amountMinor: quote.totalDebitMinor,
      recipientAmountMinor: quote.recipientAmountMinor,
      estimatedFeeMinor: quote.estimatedFeeMinor,
      currency: value.currency,
      providerAccountId: recipient.receiver,
      recipientType: recipient.recipientType,
      idempotencyKey: `payout:${payout.id}`,
    });
  } catch (error) {
    if (!isDefinitiveProviderRejection(error)) {
      throw new PayoutReconciliationRequiredError(payout.id, "submission", providerStatus(error));
    }
    try {
      await dependencies.repository.failSubmission(payout.id, "provider_rejected");
    } catch {
      throw new PayoutReconciliationRequiredError(payout.id, "release", providerStatus(error));
    }
    throw new Error("payout_submission_failed");
  }

  try {
    await dependencies.repository.attachProviderPayout(payout.id, providerResult.providerBatchId, providerResult.status, platformPayouts);
    return { payoutId: payout.id, providerBatchId: providerResult.providerBatchId, status: providerResult.status };
  } catch {
    throw new PayoutReconciliationRequiredError(payout.id, "attachment", null, providerResult.providerBatchId);
  }
}

export type PayoutProviderEvent = {
  provider: string;
  eventId: string;
  payoutId: string;
  providerPayoutItemId: string;
  status: Extract<PayoutStatus, "processing" | "completed" | "failed"> | "unclaimed";
  actualFeeMinor: number;
  providerStatus: string;
  payloadDigest: string;
  failureCode?: string | null;
};

export async function processPayoutEvent(event: PayoutProviderEvent, dependencies: { repository: PayoutRepository; notify(payload: { creatorId: string; payoutId: string; title: string; body: string; status: PayoutStatus; amountMinor?: number; currency?: Currency }): Promise<unknown> }) {
  const result = await dependencies.repository.transitionFromProvider(event);
  if (!result.newlyProcessed || event.status === "processing" || event.status === "unclaimed" || !result.creatorId || !result.payoutId) return result;
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
