import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const migration = (file: string) => readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), "utf8");
const forward = migration("202610010002_retired_payment_schema_cleanup.sql");
const rollback = readFileSync(new URL("../../supabase/rollbacks/202610010002_retired_payment_schema_cleanup.sql", import.meta.url), "utf8");
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as 'select null::uuid';`);
}, 30000);
afterAll(async () => { await db?.close(); });

beforeEach(async () => {
  await db.exec(`drop schema public cascade; create schema public;
    create type public.currency_code as enum ('USD','ARS','BRL','CLP','COP','PEN');
    create table public.profiles(id uuid primary key);
    create table public.tips(id uuid primary key, provider text, amount_minor bigint, currency public.currency_code);
    create table public.payout_accounts(id uuid primary key, provider text, provider_account_id text);
    create table public.payouts(id uuid primary key, amount_minor bigint);
    create table public.ledger_entries(id uuid primary key, amount_minor bigint);
    create table public.webhook_events(id uuid primary key, provider text);
    create function public.touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at = now(); return new; end;$$;
    insert into public.profiles values ('00000000-0000-4000-8000-000000000001');
    insert into public.tips values ('00000000-0000-4000-8000-000000000002','paypal',2000,'USD');
    insert into public.payout_accounts values ('00000000-0000-4000-8000-000000000003','paypal','creator@example.com');
    insert into public.payouts values ('00000000-0000-4000-8000-000000000004',1500);
    insert into public.ledger_entries values ('00000000-0000-4000-8000-000000000005',2000);
    insert into public.webhook_events values ('00000000-0000-4000-8000-000000000006','paypal');`);
  for (const file of [
    "202608160002_paypal_payment_accounts.sql",
    "202608200005_mercadopago_regional_accounts.sql",
    "202608210001_mercadopago_all_regions.sql",
    "202608240001_dlocalgo_payment_accounts.sql",
    "202608250001_whop_payment_accounts.sql",
    "202608210002_usd_tip_quotes.sql",
  ]) await db.exec(migration(file));
  await db.exec(`insert into public.payment_accounts (id, creator_id, provider, provider_merchant_id)
    values ('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','paypal','merchant-1');`);
}, 30000);

async function financialSnapshot() {
  const result: Record<string, unknown> = {};
  for (const table of ["profiles", "payout_accounts", "payouts", "ledger_entries", "webhook_events"]) {
    result[table] = (await db.query(`select * from public.${table} order by id`)).rows;
  }
  result.tips = (await db.query("select id,provider,amount_minor,currency,provider_capture_id from public.tips order by id")).rows;
  result.accounts = (await db.query("select id,creator_id,provider,provider_merchant_id,status from public.payment_accounts order by id")).rows;
  return result;
}

describe("retired provider schema cleanup on PostgreSQL", () => {
  it("removes only unused schema and preserves financial records, including on retry", async () => {
    const before = await financialSnapshot();
    await db.exec(forward);
    await db.exec(forward);
    expect(await financialSnapshot()).toEqual(before);
    expect((await db.query("select to_regclass('public.payment_account_credentials') as relation")).rows).toEqual([{ relation: null }]);
    expect((await db.query(`select column_name from information_schema.columns where table_schema='public'
      and column_name in ('provider_country','provider_currency','display_amount_usd_minor','exchange_rate','exchange_rate_quoted_at','exchange_rate_source')`)).rows).toEqual([]);
    await expect(db.exec("update public.payment_accounts set provider='whop'")).rejects.toThrow(/payment_accounts_provider_valid/);
  });

  it.each([
    ["credentials", "insert into public.payment_account_credentials(payment_account_id,access_token_ciphertext) values ('00000000-0000-4000-8000-000000000007','encrypted-test-token')"],
    ["retired accounts", "update public.payment_accounts set provider='whop'"],
    ["regional data", "update public.payment_accounts set provider_country='CO',provider_currency='COP'"],
    ["historical quotes", "update public.tips set display_amount_usd_minor=2000,exchange_rate=4000,exchange_rate_quoted_at=now(),exchange_rate_source='mercadopago'"],
  ])("refuses cleanup when %s exist and leaves data intact", async (_, setup) => {
    await db.exec(setup);
    const before = await financialSnapshot();
    const credentials = (await db.query("select * from public.payment_account_credentials")).rows;
    const tips = (await db.query("select * from public.tips")).rows;
    await expect(db.exec(forward)).rejects.toThrow(/cleanup_blocked/);
    await db.exec("rollback");
    expect(await financialSnapshot()).toEqual(before);
    expect((await db.query("select * from public.payment_account_credentials")).rows).toEqual(credentials);
    expect((await db.query("select * from public.tips")).rows).toEqual(tips);
  });

  it("rolls back the whole cleanup if an unknown view depends on a removed column", async () => {
    await db.exec("create view public.legacy_quote_report as select exchange_rate from public.tips");
    await expect(db.exec(forward)).rejects.toThrow(/depend/);
    await db.exec("rollback");
    expect((await db.query("select to_regclass('public.payment_account_credentials') is not null as restored")).rows).toEqual([{ restored: true }]);
    await db.query("select exchange_rate from public.legacy_quote_report");
  });

  it("restores empty legacy schema and private credential permissions before an app rollback", async () => {
    const before = await financialSnapshot();
    await db.exec(forward);
    await db.exec(rollback);
    await db.exec(rollback);
    expect(await financialSnapshot()).toEqual(before);
    expect((await db.query("select * from public.payment_account_credentials")).rows).toEqual([]);
    expect((await db.query("select display_amount_usd_minor,exchange_rate from public.tips")).rows).toEqual([{ display_amount_usd_minor: null, exchange_rate: null }]);
    expect((await db.query(`select relrowsecurity as rls from pg_class where oid='public.payment_account_credentials'::regclass`)).rows).toEqual([{ rls: true }]);
    expect((await db.query(`select has_table_privilege('anon','public.payment_account_credentials','SELECT') as anon,
      has_table_privilege('authenticated','public.payment_account_credentials','SELECT') as authenticated,
      has_table_privilege('service_role','public.payment_account_credentials','SELECT') as service`)).rows).toEqual([{ anon: false, authenticated: false, service: true }]);
    await db.exec(forward);
  });
});
