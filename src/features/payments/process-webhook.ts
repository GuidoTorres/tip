import { createHash } from "node:crypto";
import type { PaymentProvider, PaymentWebhookEvent } from "./provider";
import type { TipPushData } from "@/features/notifications/push";

type ConfirmResult = {
  newlyProcessed: boolean;
  notification?: { id: string; creatorId: string; type: "tip_confirmed" };
  tip?: TipPushData;
};

export interface WebhookRepository {
  confirm(event: PaymentWebhookEvent, payloadDigest: string): Promise<ConfirmResult>;
  reject(event: PaymentWebhookEvent, payloadDigest: string): Promise<boolean>;
  reverse(event: PaymentWebhookEvent, payloadDigest: string): Promise<boolean>;
  recordPending?(event: PaymentWebhookEvent, payloadDigest: string): Promise<boolean>;
  recordIgnored?(event: PaymentWebhookEvent, payloadDigest: string): Promise<boolean>;
  markPushAttempted(eventId: string): Promise<void>;
}

type Dependencies = {
  provider: PaymentProvider;
  repository: WebhookRepository;
  push(tip: TipPushData): Promise<unknown>;
};

export async function processPaymentWebhook(rawBody: string, headers: Headers, dependencies: Dependencies) {
  if (!await dependencies.provider.verifyWebhook({ rawBody, headers })) throw new Error("invalid_webhook");
  const event = await dependencies.provider.parseWebhook(rawBody);
  const digest = createHash("sha256").update(rawBody).digest("hex");

  if (event.status === "ignored") {
    const processed = await dependencies.repository.recordIgnored?.(event, digest);
    return { ok: true, duplicate: processed === false, status: event.status } as const;
  }

  if (event.status === "confirmed") {
    const result = await dependencies.repository.confirm(event, digest);
    if (!result.newlyProcessed) return { ok: true, duplicate: true, status: event.status } as const;
    if (result.notification && result.tip) {
      try {
        await dependencies.repository.markPushAttempted(event.eventId);
        await dependencies.push(result.tip);
      } catch {
        return { ok: true, duplicate: false, status: event.status, pushFailed: true } as const;
      }
    }
    return { ok: true, duplicate: false, status: event.status } as const;
  }
  if (event.status === "rejected") {
    const processed = await dependencies.repository.reject(event, digest);
    return { ok: true, duplicate: !processed, status: event.status } as const;
  }
  if (event.status === "refunded" || event.status === "chargeback") {
    const processed = await dependencies.repository.reverse(event, digest);
    return { ok: true, duplicate: !processed, status: event.status } as const;
  }
  const processed = await dependencies.repository.recordPending?.(event, digest);
  return { ok: true, duplicate: processed === false, status: event.status } as const;
}
