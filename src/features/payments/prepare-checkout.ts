import { z } from "zod";
import type { PaymentAccountLookup, PayoutDestinationLookup, TipRepository } from "./create-tip";
import type { PayPalFlow } from "./paypal-client";
import type { EmbeddedCheckout, PaymentProvider } from "./provider";

const inputSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(30),
});

export type CheckoutBootstrap =
  | { kind: "redirect" }
  | { kind: "embedded"; checkout: EmbeddedCheckout };

type Dependencies = {
  provider: PaymentProvider;
  creators: Pick<TipRepository, "findCreatorByUsername">;
  paymentAccounts?: PaymentAccountLookup;
  payoutDestinations?: PayoutDestinationLookup;
  providerAccountOverride?: string;
  paypalFlow?: PayPalFlow;
};

export async function prepareCheckout(input: { username: string }, dependencies: Dependencies): Promise<CheckoutBootstrap> {
  const value = inputSchema.parse(input);
  const creator = await dependencies.creators.findCreatorByUsername(value.username);
  if (!creator) throw new Error("creator_not_found");
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
