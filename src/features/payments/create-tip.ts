import { z } from "zod";
import { calculateTipBreakdown } from "@/features/ledger/money";
import { APPLICATION_CURRENCY } from "./application-currency";
import type { Currency } from "./types";
import type { PaymentProvider } from "./provider";

const inputSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(30),
  amountMinor: z.number().int().min(100).max(1_000_000),
  payerName: z.string().trim().max(60).nullable().optional(),
  message: z.string().trim().max(280).nullable().optional(),
  anonymous: z.boolean(),
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
};

export interface TipRepository {
  findCreatorByUsername(username: string): Promise<CreatorReference | null>;
  insertTip(tip: NewTip): Promise<{ id: string }>;
  attachPayment(tipId: string, payment: { providerPaymentId: string; status: "pending" | "confirmed" | "rejected" }): Promise<void>;
}

type Dependencies = { repository: TipRepository; provider: PaymentProvider; platformFeeBps: number };

export async function createTip(input: CreateTipInput, dependencies: Dependencies) {
  const value = inputSchema.parse(input);
  const creator = await dependencies.repository.findCreatorByUsername(value.username);
  if (!creator) throw new Error("creator_not_found");

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
  });
  const payment = await dependencies.provider.createPayment({
    tipId: tip.id,
    amountMinor: value.amountMinor,
    currency: APPLICATION_CURRENCY,
    idempotencyKey: `create:${tip.id}`,
  });
  await dependencies.repository.attachPayment(tip.id, {
    providerPaymentId: payment.providerPaymentId,
    status: payment.status,
  });

  return { tipId: tip.id, status: payment.status, redirectUrl: payment.checkoutUrl };
}
