import { z } from "zod";
import { calculateProcessingSupportMinor, calculateTipBreakdown } from "@/features/ledger/money";
import { APPLICATION_CURRENCY } from "./application-currency";
import type { Currency } from "./types";
import type { PaymentProvider } from "./provider";
import type { ConnectedPaymentAccount } from "./payment-account-repository";
import { CURRENT_LEGAL_TERMS_VERSION } from "@/features/legal/terms";
import { verifyPaymentQuote } from "@/lib/security/payment-quote";

const inputSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(30),
  amountMinor: z.number().int().min(100).max(100_000_000),
  payerName: z.string().trim().max(60).nullable().optional(),
  message: z.string().trim().max(280).nullable().optional(),
  anonymous: z.boolean(),
  legalAccepted: z.boolean(),
  legalTermsVersion: z.string().max(32),
  coverProcessing: z.boolean().default(false),
  paymentMethodData: z.object({
    token: z.string().min(8).max(512),
    paymentMethodId: z.string().min(1).max(80),
    issuerId: z.string().min(1).max(80).nullable().optional(),
    installments: z.number().int().min(1).max(48),
    payer: z.object({
      email: z.string().email().max(254),
      identification: z.object({ type: z.string().min(1).max(20), number: z.string().min(1).max(40) }).optional(),
    }),
  }).optional(),
  quoteToken: z.string().min(32).max(4_096).optional(),
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
  displayAmountUsdMinor: number | null;
  exchangeRate: number | null;
  exchangeRateQuotedAt: string | null;
  exchangeRateSource: string | null;
};

export interface TipRepository {
  findCreatorByUsername(username: string): Promise<CreatorReference | null>;
  insertTip(tip: NewTip): Promise<{ id: string }>;
  attachPayment(tipId: string, payment: { providerPaymentId: string; status: "pending" | "confirmed" | "rejected" }): Promise<void>;
}

export interface PaymentAccountLookup {
  findConnected(creatorId: string, provider: string): Promise<ConnectedPaymentAccount | null>;
}

export interface MercadoPagoCredentialLookup {
  findByAccountId(accountId: string, country?: string): Promise<{ accessToken: string } | null>;
}

type Dependencies = {
  repository: TipRepository;
  provider: PaymentProvider;
  platformFeeBps: number;
  checkoutFeeBps?: number;
  checkoutFixedFeeMinor?: number;
  paymentAccounts?: PaymentAccountLookup;
  mercadoPagoCredentials?: MercadoPagoCredentialLookup;
  quoteSigningSecret?: string;
  paymentReturnUrl?: (tipId: string) => string;
};

export async function createTip(input: CreateTipInput, dependencies: Dependencies) {
  const value = inputSchema.parse(input);
  if (!value.legalAccepted || value.legalTermsVersion !== CURRENT_LEGAL_TERMS_VERSION) {
    throw new Error("legal_acceptance_required");
  }
  const creator = await dependencies.repository.findCreatorByUsername(value.username);
  if (!creator) throw new Error("creator_not_found");
  let providerAccountId: string | null = null;
  let providerAccessToken: string | undefined;
  let providerCountry: string | undefined;
  let paymentCurrency: Currency = APPLICATION_CURRENCY;
  let baseAmountMinor = value.amountMinor;
  let displayAmountUsdMinor: number | null = null;
  let exchangeRate: number | null = null;
  let exchangeRateQuotedAt: string | null = null;
  let exchangeRateSource: string | null = null;
  if (dependencies.provider.name === "mercadopago") {
    const paymentAccount = await dependencies.paymentAccounts?.findConnected(creator.id, "mercadopago") ?? null;
    if (!paymentAccount?.country || !paymentAccount.currency || !["ARS", "BRL", "CLP", "COP", "MXN", "PEN", "UYU"].includes(paymentAccount.currency)) {
      throw new Error("mercadopago_account_not_connected");
    }
    const credential = await dependencies.mercadoPagoCredentials?.findByAccountId(paymentAccount.id, paymentAccount.country) ?? null;
    if (!credential) throw new Error("mercadopago_credentials_missing");
    if (!value.paymentMethodData) throw new Error("mercadopago_payment_data_missing");
    if (!value.quoteToken || !dependencies.quoteSigningSecret) throw new Error("payment_quote_required");
    const quote = verifyPaymentQuote(value.quoteToken, dependencies.quoteSigningSecret);
    if (quote.creatorId !== creator.id || quote.paymentAccountId !== paymentAccount.id
      || quote.amountUsdMinor !== value.amountMinor || quote.currency !== paymentAccount.currency) {
      throw new Error("payment_quote_mismatch");
    }
    providerAccountId = paymentAccount.providerMerchantId;
    providerAccessToken = credential.accessToken;
    providerCountry = paymentAccount.country;
    paymentCurrency = paymentAccount.currency;
    baseAmountMinor = quote.localAmountMinor;
    displayAmountUsdMinor = quote.amountUsdMinor;
    exchangeRate = quote.rate;
    exchangeRateQuotedAt = quote.quotedAt;
    exchangeRateSource = quote.source;
  }
  if (dependencies.provider.name === "dlocalgo") {
    // dLocal Go cobra en USD y convierte a la moneda del fan en su checkout,
    // así que aquí no hace falta cotización ni token de tarjeta propios.
    const paymentAccount = await dependencies.paymentAccounts?.findConnected(creator.id, "dlocalgo") ?? null;
    if (!paymentAccount) throw new Error("dlocalgo_account_not_connected");
    providerAccountId = paymentAccount.providerMerchantId;
    // `country` en dLocal Go es el país del pagador, no el de la creadora: se omite
    // a propósito para que el checkout lo detecte y ofrezca los medios locales del fan.
  }
  if (dependencies.provider.name === "whop") {
    const paymentAccount = await dependencies.paymentAccounts?.findConnected(creator.id, "whop") ?? null;
    if (!paymentAccount) throw new Error("whop_account_not_connected");
    providerAccountId = paymentAccount.providerMerchantId;
  }
  const maximumMinor = paymentCurrency === "COP" ? 100_000_000 : paymentCurrency === "MXN" ? 10_000_000 : 1_000_000;
  const minimumMinor = paymentCurrency === "COP" ? 100_000 : paymentCurrency === "MXN" ? 1_000 : 100;
  if (baseAmountMinor < minimumMinor || baseAmountMinor > maximumMinor) throw new Error("invalid_tip_amount");

  const processingSupportMinor = value.coverProcessing && dependencies.provider.name !== "mercadopago"
    ? calculateProcessingSupportMinor(baseAmountMinor, dependencies.checkoutFeeBps ?? 0, dependencies.checkoutFixedFeeMinor ?? 0)
    : 0;
  const chargedAmountMinor = baseAmountMinor + processingSupportMinor;
  const payerName = value.payerName || null;
  const anonymous = payerName === null;

  const breakdown = calculateTipBreakdown({
    amountMinor: baseAmountMinor,
    platformFeeBps: dependencies.platformFeeBps,
    gatewayFeeMinor: null,
  });
  const tip = await dependencies.repository.insertTip({
    creatorId: creator.id,
    payerName,
    message: value.message || null,
    anonymous,
    baseAmountMinor,
    processingSupportMinor,
    amountMinor: chargedAmountMinor,
    currency: paymentCurrency,
    platformFeeMinor: breakdown.platformFeeMinor,
    gatewayFeeMinor: null,
    netAmountMinor: breakdown.netAmountMinor,
    provider: dependencies.provider.name,
    legalTermsVersion: CURRENT_LEGAL_TERMS_VERSION,
    legalAcceptedAt: new Date().toISOString(),
    displayAmountUsdMinor,
    exchangeRate,
    exchangeRateQuotedAt,
    exchangeRateSource,
  });
  const payment = await dependencies.provider.createPayment({
    tipId: tip.id,
    amountMinor: chargedAmountMinor,
    platformFeeMinor: breakdown.platformFeeMinor,
    currency: paymentCurrency,
    providerAccountId,
    idempotencyKey: `create:${tip.id}`,
    ...(providerAccessToken ? { providerAccessToken } : {}),
    ...(providerCountry ? { providerCountry } : {}),
    ...(value.paymentMethodData ? { paymentMethodData: value.paymentMethodData } : {}),
    ...(dependencies.paymentReturnUrl ? { returnUrl: dependencies.paymentReturnUrl(tip.id) } : {}),
  });
  await dependencies.repository.attachPayment(tip.id, {
    providerPaymentId: payment.providerPaymentId,
    status: payment.status,
  });

  return { tipId: tip.id, providerPaymentId: payment.providerPaymentId, status: payment.status, checkout: payment.checkout };
}
