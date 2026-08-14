import { createHmac, timingSafeEqual } from "node:crypto";

export function createReceiptToken(tipId: string, secret: string) {
  return createHmac("sha256", secret).update(`receipt:${tipId}`).digest("base64url");
}

export function verifyReceiptToken(tipId: string, token: string, secret: string) {
  const expected = Buffer.from(createReceiptToken(tipId, secret));
  const received = Buffer.from(token);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
