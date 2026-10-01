import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../supabase/migrations/202609070001_creator_policy_readiness.sql", import.meta.url),
);

describe("creator policy readiness migration", () => {
  it("adds a server-controlled review gate without rewriting financial history", () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toMatch(/add column content_category text/i);
    expect(migration).toMatch(/add column creator_policy_version text/i);
    expect(migration).toMatch(/add column payment_review_status text/i);
    expect(migration).toMatch(/create trigger profiles_protect_payment_review/i);
    expect(migration).toMatch(/create or replace function public\.review_creator_policy/i);
    expect(migration).toMatch(/grant execute on function public\.review_creator_policy[^;]+to service_role/i);
    expect(migration).toMatch(/can_accept_tips boolean/i);
    expect(migration).not.toMatch(/update\s+public\.(tips|ledger_entries|payouts)/i);
    expect(migration).not.toMatch(/payment_review_status\s*=\s*'approved'/i);
  });
});
