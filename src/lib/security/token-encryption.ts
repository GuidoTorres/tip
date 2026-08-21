import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function decodeKey(encoded: string) {
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("payment_token_key_invalid");
  return key;
}

export function encryptPaymentToken(plaintext: string, encodedKey: string) {
  if (!plaintext) throw new Error("payment_token_empty");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", decodeKey(encodedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptPaymentToken(value: string, encodedKey: string) {
  try {
    const [version, ivValue, tagValue, ciphertextValue, extra] = value.split(".");
    if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue || extra) throw new Error("invalid_format");
    const decipher = createDecipheriv("aes-256-gcm", decodeKey(encodedKey), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof Error && error.message === "payment_token_key_invalid") throw error;
    throw new Error("payment_token_decrypt_failed");
  }
}

