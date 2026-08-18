-- Connected payment accounts are provider-owned identities, not TipMe wallets.
create type public.payment_account_status as enum ('pending', 'connected', 'restricted', 'disconnected');

create table public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  provider_merchant_id text not null,
  status public.payment_account_status not null default 'pending',
  onboarding_completed boolean not null default false,
  email_confirmed boolean not null default false,
  payments_receivable boolean not null default false,
  card_payments_enabled boolean not null default false,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_accounts_provider_valid check (provider in ('paypal')),
  constraint payment_accounts_provider_merchant_not_blank check (length(trim(provider_merchant_id)) > 0),
  unique (creator_id, provider),
  unique (provider, provider_merchant_id)
);

create index payment_accounts_creator_idx on public.payment_accounts (creator_id, provider, status);

alter table public.tips add column provider_capture_id text;
create unique index tips_provider_capture_unique_idx
  on public.tips (provider, provider_capture_id)
  where provider_capture_id is not null;

create trigger payment_accounts_touch
before update on public.payment_accounts
for each row execute function public.touch_updated_at();

alter table public.payment_accounts enable row level security;

create policy payment_accounts_read_own on public.payment_accounts
for select to authenticated
using (creator_id = (select auth.uid()));

revoke all on public.payment_accounts from anon, authenticated;
grant select on public.payment_accounts to authenticated;
grant select, insert, update, delete on public.payment_accounts to service_role;

