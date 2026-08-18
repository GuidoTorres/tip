import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentProvider } from "./provider";
import { verifyReceiptToken } from "@/lib/security/receipt";

export type CaptureTarget = {
  tipId: string;
  provider: string;
  providerPaymentId: string;
  providerAccountId: string | null;
  status: string;
};

export interface CaptureTipRepository {
  getTarget(tipId: string): Promise<CaptureTarget | null>;
  attachCapture(tipId: string, providerCaptureId: string | null, status: "pending" | "rejected"): Promise<void>;
}

export class SupabaseCaptureTipRepository implements CaptureTipRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getTarget(tipId: string): Promise<CaptureTarget | null> {
    const { data: tip, error } = await this.client.from("tips").select("id,creator_id,provider,provider_payment_id,status").eq("id", tipId).maybeSingle();
    if (error) throw new Error("capture_lookup_failed");
    if (!tip?.provider_payment_id) return null;
    const { data: account, error: accountError } = await this.client.from("payment_accounts").select("provider_merchant_id")
      .eq("creator_id", tip.creator_id).eq("provider", "paypal").eq("status", "connected").maybeSingle();
    if (accountError) throw new Error("capture_account_lookup_failed");
    return { tipId: tip.id, provider: tip.provider, providerPaymentId: tip.provider_payment_id,
      providerAccountId: account?.provider_merchant_id ?? null, status: tip.status };
  }

  async attachCapture(tipId: string, providerCaptureId: string | null, status: "pending" | "rejected") {
    const { error } = await this.client.from("tips").update({ provider_capture_id: providerCaptureId, status })
      .eq("id", tipId).eq("provider", "paypal").in("status", ["created", "pending"]);
    if (error) throw new Error("capture_attach_failed");
  }
}

export async function captureTip(
  input: { tipId: string; receiptToken: string },
  dependencies: { repository: CaptureTipRepository; provider: PaymentProvider; receiptSecret: string; providerAccountOverride?: string },
) {
  if (!verifyReceiptToken(input.tipId, input.receiptToken, dependencies.receiptSecret)) throw new Error("capture_not_found");
  const target = await dependencies.repository.getTarget(input.tipId);
  if (!target || target.provider !== "paypal" || dependencies.provider.name !== "paypal" || !["created", "pending"].includes(target.status)) throw new Error("capture_not_found");
  const providerAccountId = dependencies.providerAccountOverride ?? target.providerAccountId;
  if (!providerAccountId) throw new Error("capture_not_found");
  const result = await dependencies.provider.capturePayment({
    providerPaymentId: target.providerPaymentId,
    providerAccountId,
    idempotencyKey: `capture:${target.tipId}`,
  });
  const status = result.status === "rejected" ? "rejected" : "pending";
  await dependencies.repository.attachCapture(target.tipId, result.providerCaptureId, status);
  return { status: result.status === "rejected" ? "rejected" as const : "confirming" as const };
}
