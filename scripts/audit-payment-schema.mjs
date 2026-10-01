// Read-only inventory. Prints schema names and aggregate counts, never credentials
// or individual profiles, addresses, payment IDs, or OAuth tokens.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase configuration is required");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const report = { checkedAt: new Date().toISOString(), schema: {}, counts: {} };
const response = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
});
if (!response.ok) throw new Error(`Schema inventory failed: HTTP ${response.status}`);
const schema = await response.json();
for (const [table, definition] of Object.entries(schema.definitions ?? {})) {
  report.schema[table] = Object.keys(definition.properties ?? {});
}
if (!["profiles", "tips", "payment_accounts", "payout_accounts"].every((table) => table in report.schema)) {
  throw new Error("Incomplete schema inventory: check database target and service-role permissions");
}
async function count(label, table, filter = (query) => query, requiredColumns = []) {
  if (!(table in report.schema) || requiredColumns.some((column) => !report.schema[table].includes(column))) {
    report.counts[label] = { status: "absent_from_exposed_schema" };
    return;
  }
  const { count, error } = await filter(client.from(table).select("*", { count: "exact", head: true }));
  report.counts[label] = error ? { error: error.code || "request_failed" } : count;
  if (error) process.exitCode = 1;
}
await Promise.all([
  count("oauth_credentials", "payment_account_credentials"),
  count("payment_accounts", "payment_accounts"),
  count("non_paypal_payment_accounts", "payment_accounts", (q) => q.neq("provider", "paypal")),
  count("accounts_with_region", "payment_accounts", (q) => q.or("provider_country.not.is.null,provider_currency.not.is.null"), ["provider_country", "provider_currency"]),
  count("tips", "tips"),
  count("tips_with_conversion", "tips", (q) => q.or("display_amount_usd_minor.not.is.null,exchange_rate.not.is.null,exchange_rate_quoted_at.not.is.null,exchange_rate_source.not.is.null"), ["display_amount_usd_minor", "exchange_rate", "exchange_rate_quoted_at", "exchange_rate_source"]),
  count("payout_accounts", "payout_accounts"),
  count("payouts", "payouts"),
  count("ledger_entries", "ledger_entries"),
  count("webhook_events", "webhook_events"),
]);
console.log(JSON.stringify(report, null, 2));
