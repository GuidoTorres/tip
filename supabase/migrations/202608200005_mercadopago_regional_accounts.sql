-- Mercado Pago regional marketplace accounts. OAuth secrets live in a service-role-only table.
alter type public.currency_code add value if not exists 'MXN';

alter table public.payment_accounts
  drop constraint if exists payment_accounts_provider_valid;
alter table public.payment_accounts
  add constraint payment_accounts_provider_valid check (provider in ('paypal', 'mercadopago'));
alter table public.payment_accounts
  add column if not exists provider_country text,
  add column if not exists provider_currency public.currency_code;
alter table public.payment_accounts
  add constraint payment_accounts_country_valid check (provider_country is null or provider_country in ('MX', 'CO'));
alter table public.payment_accounts
  add constraint payment_accounts_region_complete check (
    provider <> 'mercadopago' or
    (provider_country = 'MX' and provider_currency::text = 'MXN') or
    (provider_country = 'CO' and provider_currency::text = 'COP')
  );

create table public.payment_account_credentials (
  payment_account_id uuid primary key references public.payment_accounts(id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_credentials_access_not_blank check (length(trim(access_token_ciphertext)) > 0)
);

create trigger payment_account_credentials_touch
before update on public.payment_account_credentials
for each row execute function public.touch_updated_at();

alter table public.payment_account_credentials enable row level security;
revoke all on public.payment_account_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.payment_account_credentials to service_role;
