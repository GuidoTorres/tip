import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_SECONDS = 300;

function digest(rawBody: string, timestamp: number, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

export function signMockWebhook(rawBody: string, timestamp: number, secret: string): string {
  return `t=${timestamp},v1=${digest(rawBody, timestamp, secret)}`;
}

export function verifyMockWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const values = Object.fromEntries(signatureHeader.split(",").map((part) => part.split("=", 2)));
  const timestamp = Number(values.t);
  const signature = values.v1;
  if (!Number.isSafeInteger(timestamp) || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(nowSeconds - timestamp) > MAX_AGE_SECONDS) return false;

  const expected = Buffer.from(digest(rawBody, timestamp, secret), "hex");
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

