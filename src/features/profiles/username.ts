const reserved = new Set([
  "admin", "api", "auth", "creator", "dashboard", "login", "logout", "manifest", "notifications",
  "onboarding", "pay", "payouts", "privacy", "settings", "signup", "support", "terms", "tips",
]);

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: "invalid" | "reserved" };

export function validateUsername(input: string): ValidationResult {
  const value = input.trim().toLowerCase();
  if (reserved.has(value)) return { ok: false, error: "reserved" };
  if (!/^[a-z0-9](?:[a-z0-9_]{1,28}[a-z0-9])$/.test(value) || value.includes("__")) {
    return { ok: false, error: "invalid" };
  }
  return { ok: true, value };
}

export function isReservedUsername(value: string): boolean {
  return reserved.has(value.trim().toLowerCase());
}

