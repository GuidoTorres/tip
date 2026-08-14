begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.app_role as enum ('creator', 'admin');
create type public.currency_code as enum ('USD', 'EUR', 'PEN', 'COP', 'BRL', 'CLP', 'ARS');
create type public.tip_status as enum ('created', 'pending', 'confirmed', 'rejected', 'refunded', 'chargeback');
create type public.ledger_entry_type as enum ('tip_confirmed', 'platform_fee', 'gateway_fee', 'payout', 'refund', 'chargeback', 'reserve_hold', 'reserve_release', 'adjustment_admin');
create type public.kyc_status as enum ('not_started', 'pending', 'verified', 'rejected');
create type public.payout_status as enum ('requested', 'processing', 'completed', 'failed');
create type public.webhook_status as enum ('received', 'processed', 'ignored', 'failed');
create type public.notification_type as enum ('tip_confirmed', 'payout_completed', 'payout_failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'creator',
  public_name text,
  username citext unique,
  avatar_url text,
  bio text,
  country text,
  preferred_currency public.currency_code not null default 'USD',
  locale text not null default 'es',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_length check (public_name is null or char_length(public_name) between 1 and 80),
  constraint profiles_username_format check (username is null or username::text ~ '^[a-z0-9](?:[a-z0-9_]{1,28}[a-z0-9])$'),
  constraint profiles_username_no_double_underscore check (username is null or position('__' in username::text) = 0),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 180),
  constraint profiles_country_format check (country is null or country ~ '^[A-Z]{2}$'),
  constraint profiles_locale check (locale in ('es', 'en')),
  constraint profiles_reserved_username check (username is null or username::text not in ('admin','api','auth','creator','dashboard','login','logout','manifest','notifications','onboarding','pay','payouts','privacy','settings','signup','support','terms','tips'))
);

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete restrict,
  payer_name text,
  message text,
  anonymous boolean not null default false,
  amount_minor bigint not null,
  currency public.currency_code not null,
  platform_fee_minor bigint not null,
  gateway_fee_minor bigint,
  net_amount_minor bigint not null,
  provider text not null,
  provider_payment_id text,
  status public.tip_status not null default 'created',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  refunded_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint tips_amount_positive check (amount_minor > 0),
  constraint tips_platform_fee_valid check (platform_fee_minor >= 0 and platform_fee_minor <= amount_minor),
  constraint tips_gateway_fee_valid check (gateway_fee_minor is null or gateway_fee_minor >= 0),
  constraint tips_net_valid check (net_amount_minor >= 0 and net_amount_minor <= amount_minor),
  constraint tips_payer_name_length check (payer_name is null or char_length(payer_name) <= 60),
  constraint tips_message_length check (message is null or char_length(message) <= 280),
  constraint tips_anonymous_identity check (not anonymous or payer_name is null),
  unique (provider, provider_payment_id)
);

create index tips_creator_created_idx on public.tips (creator_id, created_at desc);
create index tips_creator_status_idx on public.tips (creator_id, status);

create table public.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  provider_account_id text not null,
  bank_name text,
  last4 text,
  country text not null,
  status public.kyc_status not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_account_last4 check (last4 is null or last4 ~ '^[0-9]{4}$'),
  constraint payout_account_country check (country ~ '^[A-Z]{2}$'),
  unique (creator_id, provider, provider_account_id)
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete restrict,
  payout_account_id uuid not null references public.payout_accounts(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency public.currency_code not null,
  provider text not null,
  provider_payout_id text,
  idempotency_key text not null,
  status public.payout_status not null default 'requested',
  failure_code text,
  created_at timestamptz not null default now(),
  processing_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (creator_id, idempotency_key),
  unique (provider, provider_payout_id)
);

create index payouts_creator_created_idx on public.payouts (creator_id, created_at desc);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete restrict,
  tip_id uuid references public.tips(id) on delete restrict,
  payout_id uuid references public.payouts(id) on delete restrict,
  type public.ledger_entry_type not null,
  amount_minor bigint not null check (amount_minor <> 0),
  currency public.currency_code not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint ledger_single_origin check (num_nonnulls(tip_id, payout_id) <= 1)
);

create index ledger_creator_currency_created_idx on public.ledger_entries (creator_id, currency, created_at desc);
create unique index ledger_one_tip_type_idx on public.ledger_entries (tip_id, type) where tip_id is not null;
create unique index ledger_one_payout_type_idx on public.ledger_entries (payout_id, type) where payout_id is not null;

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_kind text not null default 'payment',
  payload_digest text not null,
  status public.webhook_status not null default 'received',
  error_code text,
  received_at timestamptz not null default now(),
  provider_confirmed_at timestamptz,
  processed_at timestamptz,
  push_attempted_at timestamptz,
  unique (provider, provider_event_id)
);

create index webhook_status_received_idx on public.webhook_events (status, received_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 240),
  related_tip_id uuid references public.tips(id) on delete cascade,
  related_payout_id uuid references public.payouts(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_one_origin check (num_nonnulls(related_tip_id, related_payout_id) = 1)
);

create unique index notification_one_tip_event_idx on public.notifications (related_tip_id, type) where related_tip_id is not null;
create unique index notification_one_payout_event_idx on public.notifications (related_payout_id, type) where related_payout_id is not null;
create index notifications_creator_created_idx on public.notifications (creator_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index push_creator_active_idx on public.push_subscriptions (creator_id) where revoked_at is null;

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index admin_audit_created_idx on public.admin_audit_logs (created_at desc);

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger tips_touch before update on public.tips for each row execute function public.touch_updated_at();
create trigger payout_accounts_touch before update on public.payout_accounts for each row execute function public.touch_updated_at();
create trigger payouts_touch before update on public.payouts for each row execute function public.touch_updated_at();

create function public.create_creator_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, locale)
  values (new.id, 'creator', case when coalesce(new.raw_user_meta_data->>'locale', 'es') = 'en' then 'en' else 'es' end)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_profile after insert on auth.users for each row execute function public.create_creator_profile();

create function public.prevent_profile_privilege_change() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.role <> old.role then
    raise exception 'profile privilege fields are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privilege before update on public.profiles for each row execute function public.prevent_profile_privilege_change();

create function public.prevent_ledger_mutation() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'ledger entries are immutable' using errcode = '42501';
end;
$$;

create trigger ledger_no_update before update or delete on public.ledger_entries for each row execute function public.prevent_ledger_mutation();

create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create function public.get_public_creator(requested_username text)
returns table (id uuid, public_name text, username text, avatar_url text, bio text, country text, preferred_currency public.currency_code)
language sql stable security definer set search_path = '' as $$
  select p.id, p.public_name, p.username::text, p.avatar_url, p.bio, p.country, p.preferred_currency
  from public.profiles p
  where lower(p.username::text) = lower(trim(requested_username)) and p.onboarding_completed = true;
$$;

revoke all on function public.get_public_creator(text) from public;
grant execute on function public.get_public_creator(text) to anon, authenticated;

create function public.confirm_tip_from_webhook(
  p_provider text,
  p_event_id text,
  p_payment_id text,
  p_payload_digest text,
  p_gateway_fee_minor bigint default null,
  p_provider_confirmed_at timestamptz default null
)
returns table (newly_processed boolean, notification_id uuid, creator_id uuid, tip_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_tip public.tips%rowtype;
  v_notification_id uuid;
  v_inserted integer;
  v_net bigint;
begin
  insert into public.webhook_events (provider, provider_event_id, event_kind, payload_digest, provider_confirmed_at)
  values (p_provider, p_event_id, 'payment', p_payload_digest, p_provider_confirmed_at)
  on conflict (provider, provider_event_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select t.* into v_tip from public.tips t where t.provider = p_provider and t.provider_payment_id = p_payment_id;
    select n.id into v_notification_id from public.notifications n where n.related_tip_id = v_tip.id and n.type = 'tip_confirmed';
    return query select false, v_notification_id, v_tip.creator_id, v_tip.id;
    return;
  end if;

  select t.* into v_tip
  from public.tips t
  where t.provider = p_provider and t.provider_payment_id = p_payment_id
  for update;

  if not found then
    update public.webhook_events set status = 'failed', error_code = 'tip_not_found', processed_at = now()
    where provider = p_provider and provider_event_id = p_event_id;
    return query select false, null::uuid, null::uuid, null::uuid;
    return;
  end if;

  if v_tip.status not in ('created', 'pending') then
    update public.webhook_events set status = 'ignored', error_code = 'invalid_tip_transition', processed_at = now()
    where provider = p_provider and provider_event_id = p_event_id;
    select n.id into v_notification_id from public.notifications n where n.related_tip_id = v_tip.id and n.type = 'tip_confirmed';
    return query select false, v_notification_id, v_tip.creator_id, v_tip.id;
    return;
  end if;

  if p_gateway_fee_minor is not null and (p_gateway_fee_minor < 0 or p_gateway_fee_minor > v_tip.amount_minor - v_tip.platform_fee_minor) then
    update public.webhook_events set status = 'failed', error_code = 'invalid_gateway_fee', processed_at = now()
    where provider = p_provider and provider_event_id = p_event_id;
    return query select false, null::uuid, v_tip.creator_id, v_tip.id;
    return;
  end if;

  v_net := v_tip.amount_minor - v_tip.platform_fee_minor - coalesce(p_gateway_fee_minor, 0);

  update public.tips
  set status = 'confirmed', gateway_fee_minor = p_gateway_fee_minor, net_amount_minor = v_net,
      confirmed_at = coalesce(p_provider_confirmed_at, now())
  where id = v_tip.id;

  insert into public.ledger_entries (creator_id, tip_id, type, amount_minor, currency)
  values (v_tip.creator_id, v_tip.id, 'tip_confirmed', v_tip.amount_minor, v_tip.currency);

  if v_tip.platform_fee_minor > 0 then
    insert into public.ledger_entries (creator_id, tip_id, type, amount_minor, currency)
    values (v_tip.creator_id, v_tip.id, 'platform_fee', -v_tip.platform_fee_minor, v_tip.currency);
  end if;

  if coalesce(p_gateway_fee_minor, 0) > 0 then
    insert into public.ledger_entries (creator_id, tip_id, type, amount_minor, currency)
    values (v_tip.creator_id, v_tip.id, 'gateway_fee', -p_gateway_fee_minor, v_tip.currency);
  end if;

  insert into public.notifications (creator_id, type, title, body, related_tip_id)
  values (
    v_tip.creator_id,
    'tip_confirmed',
    'Nuevo tip confirmado',
    format('%s te envió un tip', coalesce(nullif(v_tip.payer_name, ''), 'Alguien')),
    v_tip.id
  ) returning id into v_notification_id;

  update public.webhook_events set status = 'processed', processed_at = now()
  where provider = p_provider and provider_event_id = p_event_id;

  return query select true, v_notification_id, v_tip.creator_id, v_tip.id;
end;
$$;

create function public.reject_tip_from_webhook(
  p_provider text, p_event_id text, p_payment_id text, p_payload_digest text, p_occurred_at timestamptz default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_tip_id uuid; v_inserted integer;
begin
  insert into public.webhook_events (provider, provider_event_id, event_kind, payload_digest, provider_confirmed_at)
  values (p_provider, p_event_id, 'payment', p_payload_digest, p_occurred_at)
  on conflict (provider, provider_event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return false; end if;

  select id into v_tip_id from public.tips
  where provider = p_provider and provider_payment_id = p_payment_id and status in ('created', 'pending') for update;
  if v_tip_id is null then
    update public.webhook_events set status = 'ignored', error_code = 'tip_not_found_or_terminal', processed_at = now()
    where provider = p_provider and provider_event_id = p_event_id;
    return false;
  end if;
  update public.tips set status = 'rejected' where id = v_tip_id;
  update public.webhook_events set status = 'processed', processed_at = now()
  where provider = p_provider and provider_event_id = p_event_id;
  return true;
end;
$$;

create function public.reverse_tip_from_webhook(
  p_provider text,
  p_event_id text,
  p_payment_id text,
  p_payload_digest text,
  p_reversal public.tip_status,
  p_occurred_at timestamptz default null
)
returns table (newly_processed boolean, creator_id uuid, tip_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_tip public.tips%rowtype; v_inserted integer; v_entry_type public.ledger_entry_type;
begin
  if p_reversal not in ('refunded', 'chargeback') then raise exception 'invalid reversal'; end if;
  insert into public.webhook_events (provider, provider_event_id, event_kind, payload_digest, provider_confirmed_at)
  values (p_provider, p_event_id, 'payment', p_payload_digest, p_occurred_at)
  on conflict (provider, provider_event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return query select false, null::uuid, null::uuid; return; end if;

  select t.* into v_tip from public.tips t
  where t.provider = p_provider and t.provider_payment_id = p_payment_id for update;
  if not found or v_tip.status <> 'confirmed' then
    update public.webhook_events set status = 'ignored', error_code = 'tip_not_confirmed', processed_at = now()
    where provider = p_provider and provider_event_id = p_event_id;
    return query select false, v_tip.creator_id, v_tip.id; return;
  end if;
  v_entry_type := case when p_reversal = 'refunded' then 'refund'::public.ledger_entry_type else 'chargeback'::public.ledger_entry_type end;
  update public.tips set status = p_reversal, refunded_at = case when p_reversal = 'refunded' then coalesce(p_occurred_at, now()) else refunded_at end where id = v_tip.id;
  insert into public.ledger_entries (creator_id, tip_id, type, amount_minor, currency)
  values (v_tip.creator_id, v_tip.id, v_entry_type, -v_tip.net_amount_minor, v_tip.currency);
  update public.webhook_events set status = 'processed', processed_at = now()
  where provider = p_provider and provider_event_id = p_event_id;
  return query select true, v_tip.creator_id, v_tip.id;
end;
$$;

create function public.creator_balances(requested_creator uuid)
returns table (currency public.currency_code, available_minor bigint, pending_minor bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is distinct from requested_creator and not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  with currencies as (
    select le.currency from public.ledger_entries le where le.creator_id = requested_creator
    union select t.currency from public.tips t where t.creator_id = requested_creator and t.status = 'pending'
  ), available as (
    select le.currency, coalesce(sum(le.amount_minor), 0)::bigint amount
    from public.ledger_entries le where le.creator_id = requested_creator group by le.currency
  ), pending as (
    select t.currency, coalesce(sum(t.net_amount_minor), 0)::bigint amount
    from public.tips t where t.creator_id = requested_creator and t.status = 'pending' group by t.currency
  )
  select c.currency, coalesce(a.amount, 0), coalesce(p.amount, 0)
  from currencies c left join available a on a.currency = c.currency left join pending p on p.currency = c.currency;
end;
$$;

create function public.request_payout(
  p_account_id uuid, p_amount_minor bigint, p_currency public.currency_code, p_idempotency_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_creator uuid := auth.uid(); v_available bigint; v_payout_id uuid; v_account public.payout_accounts%rowtype;
begin
  if v_creator is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_amount_minor <= 0 then raise exception 'invalid amount' using errcode = '22023'; end if;
  select p.id into v_payout_id from public.payouts p
  where p.creator_id = v_creator and p.idempotency_key = p_idempotency_key;
  if v_payout_id is not null then return v_payout_id; end if;
  select pa.* into v_account from public.payout_accounts pa where pa.id = p_account_id and pa.creator_id = v_creator for update;
  if not found or v_account.status <> 'verified' then raise exception 'verified payout account required' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_creator::text || ':' || p_currency::text, 0));
  select coalesce(sum(le.amount_minor), 0) into v_available from public.ledger_entries le where le.creator_id = v_creator and le.currency = p_currency;
  if v_available < p_amount_minor then raise exception 'insufficient balance' using errcode = '22023'; end if;

  insert into public.payouts (creator_id, payout_account_id, amount_minor, currency, provider, idempotency_key)
  values (v_creator, p_account_id, p_amount_minor, p_currency, v_account.provider, p_idempotency_key)
  on conflict (creator_id, idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning id into v_payout_id;

  insert into public.ledger_entries (creator_id, payout_id, type, amount_minor, currency)
  values (v_creator, v_payout_id, 'reserve_hold', -p_amount_minor, p_currency)
  on conflict (payout_id, type) where payout_id is not null do nothing;
  return v_payout_id;
end;
$$;

create function public.transition_payout_from_provider(
  p_provider text, p_event_id text, p_provider_payout_id text, p_payload_digest text,
  p_status public.payout_status, p_failure_code text default null
)
returns table (newly_processed boolean, notification_id uuid, creator_id uuid, payout_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_payout public.payouts%rowtype; v_inserted integer; v_notification_id uuid;
begin
  if p_status not in ('processing', 'completed', 'failed') then raise exception 'invalid payout transition'; end if;
  insert into public.webhook_events (provider, provider_event_id, event_kind, payload_digest)
  values (p_provider, p_event_id, 'payout', p_payload_digest)
  on conflict (provider, provider_event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return query select false, null::uuid, null::uuid, null::uuid; return; end if;

  select p.* into v_payout from public.payouts p where p.provider = p_provider and p.provider_payout_id = p_provider_payout_id for update;
  if not found or v_payout.status in ('completed', 'failed') then
    update public.webhook_events set status = 'ignored', error_code = 'payout_not_found_or_terminal', processed_at = now()
    where provider = p_provider and provider_event_id = p_event_id;
    return query select false, null::uuid, v_payout.creator_id, v_payout.id; return;
  end if;

  if p_status = 'processing' then
    update public.payouts set status = 'processing', processing_at = now() where id = v_payout.id;
  elsif p_status = 'completed' then
    insert into public.ledger_entries (creator_id, payout_id, type, amount_minor, currency) values (v_payout.creator_id, v_payout.id, 'reserve_release', v_payout.amount_minor, v_payout.currency);
    insert into public.ledger_entries (creator_id, payout_id, type, amount_minor, currency) values (v_payout.creator_id, v_payout.id, 'payout', -v_payout.amount_minor, v_payout.currency);
    update public.payouts set status = 'completed', completed_at = now() where id = v_payout.id;
    insert into public.notifications (creator_id, type, title, body, related_payout_id)
    values (v_payout.creator_id, 'payout_completed', 'Retiro completado', 'El dinero fue enviado a tu método de retiro.', v_payout.id) returning id into v_notification_id;
  else
    insert into public.ledger_entries (creator_id, payout_id, type, amount_minor, currency) values (v_payout.creator_id, v_payout.id, 'reserve_release', v_payout.amount_minor, v_payout.currency);
    update public.payouts set status = 'failed', failed_at = now(), failure_code = p_failure_code where id = v_payout.id;
    insert into public.notifications (creator_id, type, title, body, related_payout_id)
    values (v_payout.creator_id, 'payout_failed', 'No pudimos completar tu retiro', 'Entra a TipMe para revisar el problema.', v_payout.id) returning id into v_notification_id;
  end if;
  update public.webhook_events set status = 'processed', processed_at = now() where provider = p_provider and provider_event_id = p_event_id;
  return query select true, v_notification_id, v_payout.creator_id, v_payout.id;
end;
$$;

revoke all on function public.confirm_tip_from_webhook(text,text,text,text,bigint,timestamptz) from public;
revoke all on function public.reject_tip_from_webhook(text,text,text,text,timestamptz) from public;
revoke all on function public.reverse_tip_from_webhook(text,text,text,text,public.tip_status,timestamptz) from public;
revoke all on function public.transition_payout_from_provider(text,text,text,text,public.payout_status,text) from public;
grant execute on function public.confirm_tip_from_webhook(text,text,text,text,bigint,timestamptz) to service_role;
grant execute on function public.reject_tip_from_webhook(text,text,text,text,timestamptz) to service_role;
grant execute on function public.reverse_tip_from_webhook(text,text,text,text,public.tip_status,timestamptz) to service_role;
grant execute on function public.transition_payout_from_provider(text,text,text,text,public.payout_status,text) to service_role;
revoke all on function public.creator_balances(uuid) from public;
grant execute on function public.creator_balances(uuid) to authenticated;
revoke all on function public.request_payout(uuid,bigint,public.currency_code,text) from public;
grant execute on function public.request_payout(uuid,bigint,public.currency_code,text) to authenticated;

create function public.mark_notification_read(p_notification_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.notifications set read_at = coalesce(read_at, now())
  where id = p_notification_id and creator_id = auth.uid();
  return found;
end;
$$;
revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.tips enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payout_accounts enable row level security;
alter table public.payouts enable row level security;
alter table public.webhook_events enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy profiles_read_own_or_admin on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select public.is_admin()));
create policy profiles_update_own on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy tips_read_own_or_admin on public.tips for select to authenticated
using ((select auth.uid()) = creator_id or (select public.is_admin()));

create policy ledger_read_own_or_admin on public.ledger_entries for select to authenticated
using ((select auth.uid()) = creator_id or (select public.is_admin()));

create policy payout_accounts_read_own_or_admin on public.payout_accounts for select to authenticated
using ((select auth.uid()) = creator_id or (select public.is_admin()));
create policy payout_accounts_insert_own on public.payout_accounts for insert to authenticated
with check ((select auth.uid()) = creator_id and status in ('not_started', 'pending'));
create policy payout_accounts_update_own on public.payout_accounts for update to authenticated
using ((select auth.uid()) = creator_id) with check ((select auth.uid()) = creator_id and status in ('not_started', 'pending', 'rejected'));
create policy payout_accounts_delete_own on public.payout_accounts for delete to authenticated
using ((select auth.uid()) = creator_id);

create policy payouts_read_own_or_admin on public.payouts for select to authenticated
using ((select auth.uid()) = creator_id or (select public.is_admin()));

create policy webhooks_admin_read on public.webhook_events for select to authenticated
using ((select public.is_admin()));

create policy notifications_read_own_or_admin on public.notifications for select to authenticated
using ((select auth.uid()) = creator_id or (select public.is_admin()));

create policy push_read_own on public.push_subscriptions for select to authenticated
using ((select auth.uid()) = creator_id);
create policy push_insert_own on public.push_subscriptions for insert to authenticated
with check ((select auth.uid()) = creator_id);
create policy push_update_own on public.push_subscriptions for update to authenticated
using ((select auth.uid()) = creator_id) with check ((select auth.uid()) = creator_id);
create policy push_delete_own on public.push_subscriptions for delete to authenticated
using ((select auth.uid()) = creator_id);

create policy audit_admin_read on public.admin_audit_logs for select to authenticated
using ((select public.is_admin()));

revoke all on public.profiles, public.tips, public.ledger_entries, public.payout_accounts, public.payouts,
  public.webhook_events, public.notifications, public.push_subscriptions, public.admin_audit_logs from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (public_name, username, avatar_url, bio, country, preferred_currency, locale, onboarding_completed) on public.profiles to authenticated;
grant select on public.tips, public.ledger_entries, public.payouts, public.notifications to authenticated;
grant select, insert, update, delete on public.payout_accounts, public.push_subscriptions to authenticated;
grant select on public.webhook_events, public.admin_audit_logs to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy avatar_public_read on storage.objects for select to public using (bucket_id = 'avatars');
create policy avatar_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatar_owner_update on storage.objects for update to authenticated
using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatar_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text);

alter publication supabase_realtime add table public.tips;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.payouts;

commit;
