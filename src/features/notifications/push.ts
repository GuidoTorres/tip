import type { Currency } from "@/features/payments/types";

export type TipPushData = {
  id: string;
  amountMinor: number;
  currency: Currency;
  payerName: string | null;
  message: string | null;
  anonymous: boolean;
  locale: "es" | "en";
};

export type PushPayload = { title: string; body: string; url: string; tag: string };
export type PushSubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

function money(amountMinor: number, currency: Currency, locale: "es" | "en") {
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amountMinor / 10 ** digits);
}

function shortMessage(message: string | null, max = 64) {
  if (!message) return "";
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

export function buildTipPushPayload(tip: TipPushData): PushPayload {
  const isEnglish = tip.locale === "en";
  const sender = tip.anonymous ? (isEnglish ? "Someone" : "Alguien") : tip.payerName || (isEnglish ? "Someone" : "Alguien");
  const message = shortMessage(tip.message);
  const base = isEnglish ? `${sender} sent you a tip ❤️` : `${sender} te envió un tip ❤️`;
  return {
    title: `${isEnglish ? "New tip" : "Nuevo tip"} ${money(tip.amountMinor, tip.currency, tip.locale)}`,
    body: `${base}${message ? ` “${message}”` : ""}`.slice(0, 140),
    url: `/dashboard/tips/${tip.id}`,
    tag: `tip-${tip.id}`,
  };
}

export interface PushSender {
  send(subscription: PushSubscriptionRow, payload: PushPayload): Promise<void>;
}

export async function sendCreatorPush(
  payload: PushPayload,
  subscriptions: PushSubscriptionRow[],
  sender: PushSender,
  lifecycle: { revoke(id: string): Promise<void>; markUsed(id: string): Promise<void> },
) {
  const summary = { sent: 0, revoked: 0, failed: 0 };
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await sender.send(subscription, payload);
      await lifecycle.markUsed(subscription.id);
      summary.sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await lifecycle.revoke(subscription.id);
        summary.revoked += 1;
      } else summary.failed += 1;
    }
  }));
  return summary;
}

