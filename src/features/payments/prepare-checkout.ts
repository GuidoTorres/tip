import { z } from "zod";
import type { PaymentAccountLookup, PayoutDestinationLookup, TipRepository } from "./create-tip";
import type { PayPalFlow } from "./paypal-client";
import type { EmbeddedCheckout, PaymentProvider } from "./provider";
import type { MercadoPagoCountry, MercadoPagoCurrency, MercadoPagoRegionEnv } from "./mercadopago-regions";
import { getMercadoPagoRegion } from "./mercadopago-regions";

const inputSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(30),
});

export type CheckoutBootstrap =
  | { kind: "redirect" }
  | { kind: "embedded"; checkout: EmbeddedCheckout }
  | { kind: "mercadopago"; publicKey: string; country: MercadoPagoCountry; currency: MercadoPagoCurrency };

type Dependencies = {
  provider: PaymentProvider;
  creators: Pick<TipRepository, "findCreatorByUsername">;
  paymentAccounts?: PaymentAccountLookup;
  payoutDestinations?: PayoutDestinationLookup;
  providerAccountOverride?: string;
  paypalFlow?: PayPalFlow;
  mercadoPagoEnv?: MercadoPagoRegionEnv;
};

export async function prepareCheckout(input: { username: string }, dependencies: Dependencies): Promise<CheckoutBootstrap> {
  const value = inputSchema.parse(input);
  const creator = await dependencies.creators.findCreatorByUsername(value.username);
  if (!creator) throw new Error("creator_not_found");
  if (dependencies.provider.name === "mercadopago") {
    const account = await dependencies.paymentAccounts?.findConnected(creator.id, "mercadopago") ?? null;
    if (!account?.country || !account.currency || !dependencies.mercadoPagoEnv) throw new Error("mercadopago_account_not_connected");
    const region = getMercadoPagoRegion(account.country, dependencies.mercadoPagoEnv);
    if (region.currency !== account.currency) throw new Error("mercadopago_region_mismatch");
    return { kind: "mercadopago", publicKey: region.publicKey, country: region.country, currency: region.currency };
  }
  if (!dependencies.provider.prepareCheckout) return { kind: "redirect" };

  const paypalFlow = dependencies.paypalFlow ?? "multiparty";
  let providerAccountId: string | null = null;
  if (dependencies.provider.name === "paypal" && paypalFlow === "platform_payouts") {
    const destination = await dependencies.payoutDestinations?.findConfigured(creator.id) ?? null;
    if (!destination) throw new Error("paypal_account_not_connected");
  } else if (dependencies.provider.name === "paypal") {
    const account = dependencies.providerAccountOverride
      ? null
      : await dependencies.paymentAccounts?.findConnected(creator.id, "paypal") ?? null;
    providerAccountId = dependencies.providerAccountOverride ?? account?.providerMerchantId ?? null;
    if (!providerAccountId) throw new Error("paypal_account_not_connected");
  }

  const checkout = await dependencies.provider.prepareCheckout({ providerAccountId });
  return checkout ? { kind: "embedded", checkout } : { kind: "redirect" };
}
