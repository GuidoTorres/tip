import { z } from "zod";
import type { PaymentAccountLookup, TipRepository } from "./create-tip";
import type { PaymentProvider } from "./provider";
import type { MercadoPagoCountry, MercadoPagoCurrency, MercadoPagoRegionEnv } from "./mercadopago-regions";
import { getMercadoPagoRegion } from "./mercadopago-regions";

const inputSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(30),
});

export type CheckoutBootstrap =
  | { kind: "redirect" }
  | { kind: "mercadopago"; publicKey: string; country: MercadoPagoCountry; currency: MercadoPagoCurrency };

type Dependencies = {
  provider: PaymentProvider;
  creators: Pick<TipRepository, "findCreatorByUsername">;
  paymentAccounts?: PaymentAccountLookup;
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
  if (dependencies.provider.name === "dlocalgo") {
    // Sin split_code el cobro fallaría recién al enviar: se avisa antes de mostrar el formulario.
    const account = await dependencies.paymentAccounts?.findConnected(creator.id, "dlocalgo") ?? null;
    if (!account) throw new Error("dlocalgo_account_not_connected");
  }
  if (dependencies.provider.name === "whop") {
    const account = await dependencies.paymentAccounts?.findConnected(creator.id, "whop") ?? null;
    if (!account) throw new Error("whop_account_not_connected");
  }
  return { kind: "redirect" };
}
