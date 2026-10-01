-- Apply BEFORE rolling the application back. Removed columns were required to
-- be entirely NULL, and the removed table empty, by the forward migration.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table public.payment_accounts, public.tips in access exclusive mode;

alter table public.payment_accounts
  add column if not exists provider_country text,
  add column if not exists provider_currency public.currency_code,
  drop constraint if exists payment_accounts_provider_valid,
  drop constraint if exists payment_accounts_country_valid,
  drop constraint if exists payment_accounts_region_complete;
alter table public.payment_accounts
  add constraint payment_accounts_provider_valid check (provider in ('paypal', 'mercadopago', 'dlocalgo', 'whop')),
  add constraint payment_accounts_country_valid check (
    provider_country is null or provider_country in ('AR', 'BR', 'CL', 'CO', 'MX', 'PE', 'UY')
  ),
  add constraint payment_accounts_region_complete check (
    provider <> 'mercadopago' or
    (provider_country = 'AR' and provider_currency::text = 'ARS') or
    (provider_country = 'BR' and provider_currency::text = 'BRL') or
    (provider_country = 'CL' and provider_currency::text = 'CLP') or
    (provider_country = 'CO' and provider_currency::text = 'COP') or
    (provider_country = 'MX' and provider_currency::text = 'MXN') or
    (provider_country = 'PE' and provider_currency::text = 'PEN') or
    (provider_country = 'UY' and provider_currency::text = 'UYU')
  );

create table if not exists public.payment_account_credentials (
  payment_account_id uuid primary key references public.payment_accounts(id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_credentials_access_not_blank check (length(trim(access_token_ciphertext)) > 0)
);
drop trigger if exists payment_account_credentials_touch on public.payment_account_credentials;
create trigger payment_account_credentials_touch
before update on public.payment_account_credentials
for each row execute function public.touch_updated_at();
alter table public.payment_account_credentials enable row level security;
revoke all on public.payment_account_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.payment_account_credentials to service_role;

alter table public.tips
  add column if not exists display_amount_usd_minor bigint,
  add column if not exists exchange_rate numeric(20,10),
  add column if not exists exchange_rate_quoted_at timestamptz,
  add column if not exists exchange_rate_source text,
  drop constraint if exists tips_display_amount_usd_positive,
  drop constraint if exists tips_exchange_rate_positive,
  drop constraint if exists tips_exchange_quote_complete;
alter table public.tips
  add constraint tips_display_amount_usd_positive check (display_amount_usd_minor is null or display_amount_usd_minor > 0),
  add constraint tips_exchange_rate_positive check (exchange_rate is null or exchange_rate > 0),
  add constraint tips_exchange_quote_complete check (
    (display_amount_usd_minor is null and exchange_rate is null and exchange_rate_quoted_at is null and exchange_rate_source is null)
    or
    (display_amount_usd_minor is not null and exchange_rate is not null and exchange_rate_quoted_at is not null and exchange_rate_source = 'mercadopago')
  );

notify pgrst, 'reload schema';
commit;
