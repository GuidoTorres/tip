import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../supabase/migrations/202608120001_tipme_core.sql", import.meta.url),
);
const migration = readFileSync(migrationPath, "utf8");
const usernameFixPath = fileURLToPath(
  new URL("../../supabase/migrations/202608130001_fix_username_double_underscore.sql", import.meta.url),
);
const usdMigrationPath = fileURLToPath(
  new URL("../../supabase/migrations/202608160001_set_application_currency_usd.sql", import.meta.url),
);
const paypalMigrationPath = fileURLToPath(
  new URL("../../supabase/migrations/202608160002_paypal_payment_accounts.sql", import.meta.url),
);

describe("database migration safety", () => {
  it("does not resolve citext through an empty function search path", () => {
    expect(migration).not.toMatch(/::citext\b/);
  });

  it("does not treat SQL LIKE underscores as literal username underscores", () => {
    expect(migration).not.toContain("username::text not like '%__%'");
    expect(migration).toContain("position('__' in username::text) = 0");
  });

  it("contains a corrective migration for databases already initialized", () => {
    expect(existsSync(usernameFixPath)).toBe(true);
    if (!existsSync(usernameFixPath)) return;

    const usernameFix = readFileSync(usernameFixPath, "utf8");
    expect(usernameFix).toContain("drop constraint if exists profiles_username_no_double_underscore");
    expect(usernameFix).toContain("position('__' in username::text) = 0");
  });

  it("sets profile preferences to USD without relabeling financial history", () => {
    expect(existsSync(usdMigrationPath)).toBe(true);
    if (!existsSync(usdMigrationPath)) return;

    const usdMigration = readFileSync(usdMigrationPath, "utf8");
    expect(usdMigration).toMatch(/update\s+public\.profiles\s+set\s+preferred_currency\s*=\s*'USD'/i);
    expect(usdMigration).not.toMatch(/update\s+public\.(tips|ledger_entries|payouts)/i);
  });

  it("isolates connected PayPal accounts and capture identifiers", () => {
    expect(existsSync(paypalMigrationPath)).toBe(true);
    if (!existsSync(paypalMigrationPath)) return;

    const paypalMigration = readFileSync(paypalMigrationPath, "utf8");
    expect(paypalMigration).toMatch(/create table public\.payment_accounts/i);
    expect(paypalMigration).toMatch(/alter table public\.payment_accounts enable row level security/i);
    expect(paypalMigration).toMatch(/creator_id\s*=\s*\(select auth\.uid\(\)\)/i);
    expect(paypalMigration).toMatch(/add column provider_capture_id text/i);
    expect(paypalMigration).toMatch(/unique[^;]+provider_capture_id/is);
    expect(paypalMigration).not.toMatch(/grant (insert|update|delete)[^;]+payment_accounts[^;]+authenticated/i);
  });
});
