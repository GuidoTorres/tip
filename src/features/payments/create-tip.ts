import { z } from "zod";
import { calculateTipBreakdown } from "@/features/ledger/money";
import { APPLICATION_CURRENCY } from "./application-currency";
import type { Currency } from "./types";
import type { PaymentProvider } from "./provider";
import type { ConnectedPaymentAccount } from "./payment-account-repository";
import { CURRENT_LEGAL_TERMS_VERSION } from "@/features/legal/terms";

const inputSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(30),
  amountMinor: z.number().int().min(100).max(1_000_000),
  payerName: z.string().trim().max(60).nullable().optional(),
  message: z.string().trim().max(280).nullable().optional(),
  anonymous: z.boolean(),
  legalAccepted: z.boolean(),
  legalTermsVersion: z.string().max(32),
});

export type CreateTipInput = z.infer<typeof inputSchema>;

type CreatorReference = { id: string; currency: Currency };
type NewTip = {
  creatorId: string;
  payerName: string | null;
  message: string | null;
  anonymous: boolean;
  amountMinor: number;
  currency: Currency;
  platformFeeMinor: number;
  gatewayFeeMinor: null;
  netAmountMinor: number;
  provider: string;
  legalTermsVersion: string;
  legalAcceptedAt: string;
};

export interface TipRepository {
  findCreatorByUsername(username: string): Promise<CreatorReference | null>;
  insertTip(tip: NewTip): Promise<{ id: string }>;
  attachPayment(tipId: string, payment: { providerPaymentId: string; status: "pending" | "confirmed" | "rejected" }): Promise<void>;
}

export interface PaymentAccountLookup {
  findConnected(creatorId: string, provider: string): Promise<ConnectedPaymentAccount | null>;
}

type Dependencies = { repository: TipRepository; provider: PaymentProvider; platformFeeBps: number; paymentAccounts?: PaymentAccountLookup; providerAccountOverride?: string };

export async function createTip(input: CreateTipInput, dependencies: Dependencies) {
  const value = inputSchema.parse(input);
  if (!value.legalAccepted || value.legalTermsVersion !== CURRENT_LEGAL_TERMS_VERSION) {
    throw new Error("legal_acceptance_required");
  }
  const creator = await dependencies.repository.findCreatorByUsername(value.username);
  if (!creator) throw new Error("creator_not_found");
  const paymentAccount = dependencies.provider.name === "paypal" && !dependencies.providerAccountOverride
    ? await dependencies.paymentAccounts?.findConnected(creator.id, "paypal") ?? null
    : null;
  const providerAccountId = dependencies.providerAccountOverride ?? paymentAccount?.providerMerchantId ?? null;
  if (dependencies.provider.name === "paypal" && !providerAccountId) throw new Error("paypal_account_not_connected");

  const breakdown = calculateTipBreakdown({
    amountMinor: value.amountMinor,
    platformFeeBps: dependencies.platformFeeBps,
    gatewayFeeMinor: null,
  });
  const tip = await dependencies.repository.insertTip({
    creatorId: creator.id,
    payerName: value.anonymous ? null : value.payerName || null,
    message: value.message || null,
    anonymous: value.anonymous,
    amountMinor: value.amountMinor,
    currency: APPLICATION_CURRENCY,
    platformFeeMinor: breakdown.platformFeeMinor,
    gatewayFeeMinor: null,
    netAmountMinor: breakdown.netAmountMinor,
    provider: dependencies.provider.name,
    legalTermsVersion: CURRENT_LEGAL_TERMS_VERSION,
    legalAcceptedAt: new Date().toISOString(),
  });
  const payment = await dependencies.provider.createPayment({
    tipId: tip.id,
    amountMinor: value.amountMinor,
    platformFeeMinor: breakdown.platformFeeMinor,
    currency: APPLICATION_CURRENCY,
    providerAccountId,
    idempotencyKey: `create:${tip.id}`,
  });
  await dependencies.repository.attachPayment(tip.id, {
    providerPaymentId: payment.providerPaymentId,
    status: payment.status,
  });

  return { tipId: tip.id, providerPaymentId: payment.providerPaymentId, status: payment.status, checkout: payment.checkout };
}
