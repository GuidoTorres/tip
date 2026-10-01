-- Deploy the application without quote-column readers/writers BEFORE this file.
-- Refuses to discard populated legacy data. No CASCADE, financial row deletion,
-- or history rewriting. See docs/database-cleanup.md for rollout and rollback.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.payment_accounts, public.tips in access exclusive mode;

do $$
declare
  candidate record;
  populated boolean;
begin
  if exists (select 1 from public.payment_accounts where provider <> 'paypal') then
    raise exception 'cleanup_blocked: non-PayPal payment accounts exist';
  end if;

  if to_regclass('public.payment_account_credentials') is not null then
    execute 'lock table public.payment_account_credentials in access exclusive mode';
    execute 'select exists (select 1 from public.payment_account_credentials)' into populated;
    if populated then
      raise exception 'cleanup_blocked: legacy OAuth credentials exist';
    end if;
  end if;

  for candidate in
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and (
      (table_name = 'payment_accounts' and column_name in ('provider_country', 'provider_currency'))
      or (table_name = 'tips' and column_name in (
        'display_amount_usd_minor', 'exchange_rate', 'exchange_rate_quoted_at', 'exchange_rate_source'
      ))
    )
  loop
    execute format('select exists (select 1 from public.%I where %I is not null)',
      candidate.table_name, candidate.column_name) into populated;
    if populated then
      raise exception 'cleanup_blocked: %.% contains historical data', candidate.table_name, candidate.column_name;
    end if;
  end loop;
end;
$$;

drop table if exists public.payment_account_credentials;

alter table public.payment_accounts
  drop constraint if exists payment_accounts_country_valid,
  drop constraint if exists payment_accounts_region_complete,
  drop constraint if exists payment_accounts_provider_valid,
  drop column if exists provider_country,
  drop column if exists provider_currency;
alter table public.payment_accounts
  add constraint payment_accounts_provider_valid check (provider = 'paypal');

alter table public.tips
  drop constraint if exists tips_display_amount_usd_positive,
  drop constraint if exists tips_exchange_rate_positive,
  drop constraint if exists tips_exchange_quote_complete,
  drop column if exists display_amount_usd_minor,
  drop column if exists exchange_rate,
  drop column if exists exchange_rate_quoted_at,
  drop column if exists exchange_rate_source;

notify pgrst, 'reload schema';
commit;
