import { describe, expect, it } from "vitest";
import { decryptPaymentToken, encryptPaymentToken } from "@/lib/security/token-encryption";

const key = Buffer.alloc(32, 7).toString("base64");

describe("payment token encryption", () => {
  it("round trips an OAuth token without storing plaintext", () => {
    const encrypted = encryptPaymentToken("APP_USR-secret-token", key);

    expect(encrypted).not.toContain("APP_USR-secret-token");
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(decryptPaymentToken(encrypted, key)).toBe("APP_USR-secret-token");
  });

  it("rejects a tampered authenticated ciphertext", () => {
    const encrypted = encryptPaymentToken("refresh-secret", key);
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;

    expect(() => decryptPaymentToken(tampered, key)).toThrow("payment_token_decrypt_failed");
  });

  it("rejects keys that are not exactly 32 bytes", () => {
    expect(() => encryptPaymentToken("secret", Buffer.alloc(16).toString("base64"))).toThrow("payment_token_key_invalid");
  });
});

