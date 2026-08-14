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
});
