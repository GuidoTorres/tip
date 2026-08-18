import { randomBytes, timingSafeEqual } from "node:crypto";

export function createOAuthState() {
  return randomBytes(32).toString("base64url");
}

export function verifyOAuthState(expected: string, received: string) {
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length >= 32 && expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}
