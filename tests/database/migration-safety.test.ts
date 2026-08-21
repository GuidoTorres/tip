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
const legalAcceptanceMigrationPath = fileURLToPath(
  new URL("../../supabase/migrations/202608180003_tip_legal_acceptance.sql", import.meta.url),
);
const creatorTotalsMigrationPath = fileURLToPath(
  new URL("../../supabase/migrations/202608180004_creator_tip_totals.sql", import.meta.url),
);
const platformPayoutsMigrationPath = fileURLToPath(
  new URL("../../supabase/migrations/202608200001_paypal_platform_payouts.sql", import.meta.url),
);
const platformPayoutsMigration = readFileSync(platformPayoutsMigrationPath, "utf8");
const operationCodeMigrationPath = fileURLToPath(
  new URL("../../supabase/migrations/202608200003_tip_operation_codes.sql", import.meta.url),
);
const payoutConflictFixPath = fileURLToPath(
  new URL("../../supabase/migrations/202608200004_fix_payout_ledger_conflicts.sql", import.meta.url),
);
const mercadoPagoMigrationPath = fileURLToPath(
  new URL("../../supabase/migrations/202608200005_mercadopago_regional_accounts.sql", import.meta.url),
);
const mercadoPagoAllRegionsMigrationPath = fileURLToPath(
  new URL("../../supabase/migrations/202608210001_mercadopago_all_regions.sql", import.meta.url),
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

  it("records legal acceptance without changing historical tips", () => {
    expect(existsSync(legalAcceptanceMigrationPath)).toBe(true);
    if (!existsSync(legalAcceptanceMigrationPath)) return;

    const legalMigration = readFileSync(legalAcceptanceMigrationPath, "utf8");
    expect(legalMigration).toMatch(/add column legal_terms_version text/i);
    expect(legalMigration).toMatch(/add column legal_accepted_at timestamptz/i);
    expect(legalMigration).not.toMatch(/update\s+public\.tips/i);
  });

  it("aggregates only confirmed creator tips behind an authenticated RPC", () => {
    expect(existsSync(creatorTotalsMigrationPath)).toBe(true);
    if (!existsSync(creatorTotalsMigrationPath)) return;

    const totalsMigration = readFileSync(creatorTotalsMigrationPath, "utf8");
    expect(totalsMigration).toMatch(/create or replace function public\.creator_tip_totals/i);
    expect(totalsMigration).toMatch(/t\.status\s*=\s*'confirmed'/i);
    expect(totalsMigration).toMatch(/auth\.uid\(\) is distinct from requested_creator/i);
    expect(totalsMigration).toMatch(/grant execute on function public\.creator_tip_totals/i);
    expect(totalsMigration).not.toMatch(/update\s+public\.(tips|ledger_entries)/i);
  });

  it("keeps PayPal payout verification and financial transitions server-controlled", () => {
    expect(existsSync(platformPayoutsMigrationPath)).toBe(true);
    if (!existsSync(platformPayoutsMigrationPath)) return;

    expect(platformPayoutsMigration).toMatch(/create or replace function public\.set_my_paypal_payout_email/i);
    expect(platformPayoutsMigration).toMatch(/revoke (insert|update|delete)[^;]+payout_accounts[^;]+authenticated/i);
    expect(platformPayoutsMigration).toMatch(/grant execute on function public\.set_my_paypal_payout_email\(text\) to authenticated/i);
    expect(platformPayoutsMigration).toMatch(/create or replace function public\.request_platform_payout/i);
    expect(platformPayoutsMigration).toMatch(/grant execute on function public\.request_platform_payout[^;]+to service_role/i);
    expect(platformPayoutsMigration).not.toMatch(/grant execute on function public\.request_platform_payout[^;]+to authenticated/i);
    expect(platformPayoutsMigration).toMatch(/v_account\.status not in \('pending', 'verified'\)/i);
    expect(platformPayoutsMigration).toMatch(/update public\.payout_accounts\s+set status = 'verified'/i);
  });

  it("avoids ambiguous payout_id conflict targets in payout ledger functions", () => {
    expect(platformPayoutsMigration).not.toMatch(/on conflict \(payout_id, type\) where payout_id is not null/i);
    expect(existsSync(payoutConflictFixPath)).toBe(true);
    if (!existsSync(payoutConflictFixPath)) return;

    const payoutConflictFix = readFileSync(payoutConflictFixPath, "utf8");
    expect(payoutConflictFix).toMatch(/create or replace function public\.fail_platform_payout_submission/i);
    expect(payoutConflictFix).toMatch(/create or replace function public\.transition_platform_payout_from_provider/i);
    expect(payoutConflictFix).not.toMatch(/on conflict \(payout_id, type\) where payout_id is not null/i);
  });

  it("assigns non-sequential unique operation codes to every tip", () => {
    expect(existsSync(operationCodeMigrationPath)).toBe(true);
    if (!existsSync(operationCodeMigrationPath)) return;

    const operationCodeMigration = readFileSync(operationCodeMigrationPath, "utf8");
    expect(operationCodeMigration).toMatch(/add column if not exists operation_code text/i);
    expect(operationCodeMigration).toMatch(/alter column operation_code set not null/i);
    expect(operationCodeMigration).toMatch(/unique[^;]+operation_code/is);
    expect(operationCodeMigration).toMatch(/gen_random_uuid\(\)/i);
    expect(operationCodeMigration).not.toMatch(/provider_payment_id\s*(?:\|\||::)/i);
  });

  it("keeps Mercado Pago OAuth credentials private and supports regional currencies", () => {
    expect(existsSync(mercadoPagoMigrationPath)).toBe(true);
    if (!existsSync(mercadoPagoMigrationPath)) return;

    const mercadoPagoMigration = readFileSync(mercadoPagoMigrationPath, "utf8");
    expect(mercadoPagoMigration).toMatch(/alter type public\.currency_code add value if not exists 'MXN'/i);
    expect(mercadoPagoMigration).toMatch(/provider in \('paypal', 'mercadopago'\)/i);
    expect(mercadoPagoMigration).toMatch(/create table public\.payment_account_credentials/i);
    expect(mercadoPagoMigration).toMatch(/alter table public\.payment_account_credentials enable row level security/i);
    expect(mercadoPagoMigration).toMatch(/revoke all on public\.payment_account_credentials from public, anon, authenticated/i);
    expect(mercadoPagoMigration).not.toMatch(/grant select[^;]+payment_account_credentials[^;]+authenticated/i);
    expect(mercadoPagoMigration).toMatch(/grant select, insert, update, delete on public\.payment_account_credentials to service_role/i);
  });

  it("extends Mercado Pago accounts to every supported Split Payments region", () => {
    expect(existsSync(mercadoPagoAllRegionsMigrationPath)).toBe(true);
    if (!existsSync(mercadoPagoAllRegionsMigrationPath)) return;

    const regionalMigration = readFileSync(mercadoPagoAllRegionsMigrationPath, "utf8");
    expect(regionalMigration).toMatch(/alter type public\.currency_code add value if not exists 'UYU'/i);
    for (const country of ["AR", "BR", "CL", "CO", "MX", "PE", "UY"]) {
      expect(regionalMigration).toContain(`provider_country = '${country}'`);
    }
  });
});
