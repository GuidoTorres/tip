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
    // Alterar el último carácter base64url no basta: solo codifica 4 bits
    // significativos, así que A/B/C/D decodifican al mismo byte y el test
    // pasaba a ser intermitente. Se altera un byte real del texto cifrado.
    const [version, iv, tag, ciphertext] = encrypted.split(".");
    const bytes = Buffer.from(ciphertext, "base64url");
    bytes[0] ^= 0xff;
    const tampered = [version, iv, tag, bytes.toString("base64url")].join(".");

    expect(() => decryptPaymentToken(tampered, key)).toThrow("payment_token_decrypt_failed");
  });

  it("rejects keys that are not exactly 32 bytes", () => {
    expect(() => encryptPaymentToken("secret", Buffer.alloc(16).toString("base64"))).toThrow("payment_token_key_invalid");
  });
});

