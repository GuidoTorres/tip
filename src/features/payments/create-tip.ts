import { z } from "zod";
import { calculateProcessingSupportMinor, calculateTipBreakdown } from "@/features/ledger/money";
import { APPLICATION_CURRENCY } from "./application-currency";
import type { Currency } from "./types";
import type { PaymentProvider } from "./provider";
import type { ConnectedPaymentAccount } from "./payment-account-repository";
import { CURRENT_LEGAL_TERMS_VERSION } from "@/features/legal/terms";
import type { PayPalFlow } from "./paypal-client";

const inputSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(30),
  amountMinor: z.number().int().min(100).max(1_000_000),
  payerName: z.string().trim().max(60).nullable().optional(),
  message: z.string().trim().max(280).nullable().optional(),
  anonymous: z.boolean(),
  legalAccepted: z.boolean(),
  legalTermsVersion: z.string().max(32),
  coverProcessing: z.boolean().default(false),
});

export type CreateTipInput = z.input<typeof inputSchema>;

type CreatorReference = { id: string; currency: Currency };
type NewTip = {
  creatorId: string;
  payerName: string | null;
  message: string | null;
  anonymous: boolean;
  baseAmountMinor: number;
  processingSupportMinor: number;
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

export interface PayoutDestinationLookup {
  findConfigured(creatorId: string): Promise<{ id: string; status: "pending" | "verified" } | null>;
}

type Dependencies = {
  repository: TipRepository;
  provider: PaymentProvider;
  platformFeeBps: number;
  paypalFlow?: PayPalFlow;
  checkoutFeeBps?: number;
  checkoutFixedFeeMinor?: number;
  paymentAccounts?: PaymentAccountLookup;
  payoutDestinations?: PayoutDestinationLookup;
  providerAccountOverride?: string;
};

export async function createTip(input: CreateTipInput, dependencies: Dependencies) {
  const value = inputSchema.parse(input);
  if (!value.legalAccepted || value.legalTermsVersion !== CURRENT_LEGAL_TERMS_VERSION) {
    throw new Error("legal_acceptance_required");
  }
  const creator = await dependencies.repository.findCreatorByUsername(value.username);
  if (!creator) throw new Error("creator_not_found");
  const paypalFlow = dependencies.paypalFlow ?? "multiparty";
  let providerAccountId: string | null = null;
  if (dependencies.provider.name === "paypal" && paypalFlow === "platform_payouts") {
    const destination = await dependencies.payoutDestinations?.findConfigured(creator.id) ?? null;
    if (!destination) throw new Error("paypal_account_not_connected");
  } else if (dependencies.provider.name === "paypal") {
    const paymentAccount = dependencies.providerAccountOverride
      ? null
      : await dependencies.paymentAccounts?.findConnected(creator.id, "paypal") ?? null;
    providerAccountId = dependencies.providerAccountOverride ?? paymentAccount?.providerMerchantId ?? null;
    if (!providerAccountId) throw new Error("paypal_account_not_connected");
  }

  const processingSupportMinor = value.coverProcessing
    ? calculateProcessingSupportMinor(value.amountMinor, dependencies.checkoutFeeBps ?? 0, dependencies.checkoutFixedFeeMinor ?? 0)
    : 0;
  const chargedAmountMinor = value.amountMinor + processingSupportMinor;

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
    baseAmountMinor: value.amountMinor,
    processingSupportMinor,
    amountMinor: chargedAmountMinor,
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
    amountMinor: chargedAmountMinor,
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
