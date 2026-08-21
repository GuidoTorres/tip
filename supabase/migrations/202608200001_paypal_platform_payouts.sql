-- Centralized PayPal checkout + PayPal Payouts for the pilot.
-- The browser can configure a destination email, but only trusted server code can
-- reserve money, submit payouts, or mark a destination as verified.

alter table public.tips
  add column if not exists base_amount_minor bigint,
  add column if not exists processing_support_minor bigint not null default 0;

update public.tips
set base_amount_minor = amount_minor
where base_amount_minor is null;

alter table public.tips
  alter column base_amount_minor set not null,
  add constraint tips_base_amount_positive check (base_amount_minor > 0),
  add constraint tips_processing_support_valid check (processing_support_minor >= 0),
  add constraint tips_amount_components_match check (amount_minor = base_amount_minor + processing_support_minor);

alter table public.payouts
  add column if not exists recipient_amount_minor bigint,
  add column if not exists estimated_fee_minor bigint not null default 0,
  add column if not exists gateway_fee_minor bigint,
  add column if not exists provider_payout_item_id text,
  add column if not exists provider_status text;

update public.payouts
set recipient_amount_minor = amount_minor
where recipient_amount_minor is null;

alter table public.payouts
  alter column recipient_amount_minor set not null,
  add constraint payouts_recipient_amount_positive check (recipient_amount_minor > 0),
  add constraint payouts_estimated_fee_valid check (estimated_fee_minor >= 0),
  add constraint payouts_gateway_fee_valid check (gateway_fee_minor is null or gateway_fee_minor >= 0),
  add constraint payouts_amount_components_match check (amount_minor = recipient_amount_minor + estimated_fee_minor);

create unique index if not exists payouts_provider_item_unique_idx
on public.payouts (provider, provider_payout_item_id)
where provider_payout_item_id is not null;

drop policy if exists payout_accounts_insert_own on public.payout_accounts;
drop policy if exists payout_accounts_update_own on public.payout_accounts;
drop policy if exists payout_accounts_delete_own on public.payout_accounts;
revoke insert, update, delete on public.payout_accounts from authenticated;

create or replace function public.set_my_paypal_payout_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator_id uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_account public.payout_accounts%rowtype;
begin
  if v_creator_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if v_email is null
     or char_length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid PayPal email' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_creator_id::text || ':paypal-payout-account', 0));

  select pa.* into v_account
  from public.payout_accounts pa
  where pa.creator_id = v_creator_id and pa.provider = 'paypal'
  order by pa.created_at asc
  limit 1
  for update;

  if found then
    update public.payout_accounts
    set provider_account_id = v_email,
        bank_name = 'PayPal',
        last4 = null,
        country = 'XX',
        status = case
          when provider_account_id = v_email and status = 'verified' then 'verified'::public.kyc_status
          else 'pending'::public.kyc_status
        end,
        updated_at = now()
    where id = v_account.id
    returning * into v_account;
  else
    insert into public.payout_accounts (
      creator_id, provider, provider_account_id, bank_name, country, status
    ) values (
      v_creator_id, 'paypal', v_email, 'PayPal', 'XX', 'pending'
    )
    returning * into v_account;
  end if;

  return v_account.id;
end;
$$;

revoke all on function public.set_my_paypal_payout_email(text) from public;
grant execute on function public.set_my_paypal_payout_email(text) to authenticated;

create or replace function public.request_platform_payout(
  p_creator_id uuid,
  p_account_id uuid,
  p_total_debit_minor bigint,
  p_recipient_amount_minor bigint,
  p_estimated_fee_minor bigint,
  p_currency public.currency_code,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_available bigint;
  v_payout_id uuid;
  v_account public.payout_accounts%rowtype;
begin
  if p_creator_id is null
     or p_total_debit_minor <= 0
     or p_recipient_amount_minor <= 0
     or p_estimated_fee_minor < 0
     or p_total_debit_minor <> p_recipient_amount_minor + p_estimated_fee_minor
     or nullif(trim(p_idempotency_key), '') is null then
    raise exception 'invalid payout request' using errcode = '22023';
  end if;

  select p.id into v_payout_id
  from public.payouts p
  where p.creator_id = p_creator_id and p.idempotency_key = p_idempotency_key;
  if v_payout_id is not null then
    return v_payout_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_creator_id::text || ':' || p_currency::text, 0));

  select pa.* into v_account
  from public.payout_accounts pa
  where pa.id = p_account_id
    and pa.creator_id = p_creator_id
    and pa.provider = 'paypal'
  for update;

  if not found or v_account.status not in ('pending', 'verified') then
    raise exception 'configured PayPal payout account required' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.payouts p
    where p.creator_id = p_creator_id
      and p.currency = p_currency
      and p.status in ('requested', 'processing')
  ) then
    raise exception 'a payout is already in progress' using errcode = '22023';
  end if;

  select coalesce(sum(le.amount_minor), 0)::bigint into v_available
  from public.ledger_entries le
  where le.creator_id = p_creator_id and le.currency = p_currency;

  if v_available < p_total_debit_minor then
    raise exception 'insufficient balance' using errcode = '22023';
  end if;

  insert into public.payouts (
    creator_id,
    payout_account_id,
    amount_minor,
    recipient_amount_minor,
    estimated_fee_minor,
    currency,
    provider,
    idempotency_key
  ) values (
    p_creator_id,
    p_account_id,
    p_total_debit_minor,
    p_recipient_amount_minor,
    p_estimated_fee_minor,
    p_currency,
    'paypal',
    p_idempotency_key
  )
  returning id into v_payout_id;

  insert into public.ledger_entries (
    creator_id, payout_id, type, amount_minor, currency, metadata
  ) values (
    p_creator_id,
    v_payout_id,
    'reserve_hold',
    -p_total_debit_minor,
    p_currency,
    jsonb_build_object(
      'recipient_amount_minor', p_recipient_amount_minor,
      'estimated_fee_minor', p_estimated_fee_minor
    )
  );

  return v_payout_id;
end;
$$;

revoke all on function public.request_platform_payout(uuid,uuid,bigint,bigint,bigint,public.currency_code,text) from public;
grant execute on function public.request_platform_payout(uuid,uuid,bigint,bigint,bigint,public.currency_code,text) to service_role;

create or replace function public.attach_platform_payout(
  p_payout_id uuid,
  p_provider_batch_id text,
  p_provider_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(trim(p_provider_batch_id), '') is null then
    raise exception 'provider batch id required' using errcode = '22023';
  end if;

  update public.payouts
  set provider_payout_id = p_provider_batch_id,
      provider_status = nullif(trim(p_provider_status), ''),
      status = 'processing',
      processing_at = coalesce(processing_at, now()),
      updated_at = now()
  where id = p_payout_id
    and provider = 'paypal'
    and status = 'requested'
    and provider_payout_id is null;

  return found;
end;
$$;

revoke all on function public.attach_platform_payout(uuid,text,text) from public;
grant execute on function public.attach_platform_payout(uuid,text,text) to service_role;

create or replace function public.fail_platform_payout_submission(
  p_payout_id uuid,
  p_failure_code text
)
returns table (notification_id uuid, creator_id uuid, payout_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout public.payouts%rowtype;
  v_notification_id uuid;
begin
  select p.* into v_payout
  from public.payouts p
  where p.id = p_payout_id and p.provider = 'paypal'
  for update;

  if not found
     or v_payout.status <> 'requested'
     or v_payout.provider_payout_id is not null then
    return;
  end if;

  insert into public.ledger_entries (creator_id, payout_id, type, amount_minor, currency)
  values (v_payout.creator_id, v_payout.id, 'reserve_release', v_payout.amount_minor, v_payout.currency)
  on conflict do nothing;

  update public.payouts
  set status = 'failed',
      failed_at = now(),
      failure_code = coalesce(nullif(trim(p_failure_code), ''), 'submission_failed'),
      updated_at = now()
  where id = v_payout.id;

  insert into public.notifications (creator_id, type, title, body, related_payout_id)
  values (
    v_payout.creator_id,
    'payout_failed',
    'No pudimos completar tu retiro',
    'Entra a TipMe para revisar el problema.',
    v_payout.id
  )
  on conflict (related_payout_id, type) where related_payout_id is not null do nothing
  returning id into v_notification_id;

  return query select v_notification_id, v_payout.creator_id, v_payout.id;
end;
$$;

revoke all on function public.fail_platform_payout_submission(uuid,text) from public;
grant execute on function public.fail_platform_payout_submission(uuid,text) to service_role;

create or replace function public.transition_platform_payout_from_provider(
  p_provider text,
  p_event_id text,
  p_payout_id uuid,
  p_provider_payout_item_id text,
  p_payload_digest text,
  p_status text,
  p_actual_fee_minor bigint,
  p_provider_status text,
  p_failure_code text default null
)
returns table (newly_processed boolean, notification_id uuid, creator_id uuid, payout_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout public.payouts%rowtype;
  v_inserted integer;
  v_notification_id uuid;
begin
  if p_provider <> 'paypal'
     or p_status not in ('processing', 'completed', 'failed')
     or p_actual_fee_minor < 0 then
    raise exception 'invalid payout transition' using errcode = '22023';
  end if;

  insert into public.webhook_events (
    provider, provider_event_id, event_kind, payload_digest
  ) values (
    p_provider, p_event_id, 'payout', p_payload_digest
  )
  on conflict (provider, provider_event_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return query select false, null::uuid, null::uuid, null::uuid;
    return;
  end if;

  select p.* into v_payout
  from public.payouts p
  where p.id = p_payout_id and p.provider = p_provider
  for update;

  if not found or v_payout.status in ('completed', 'failed') then
    update public.webhook_events
    set status = 'ignored',
        error_code = 'payout_not_found_or_terminal',
        processed_at = now()
    where provider = p_provider and provider_event_id = p_event_id;

    return query select false, null::uuid, v_payout.creator_id, v_payout.id;
    return;
  end if;

  if p_status = 'processing' then
    update public.payouts
    set status = 'processing',
        provider_payout_item_id = coalesce(nullif(trim(p_provider_payout_item_id), ''), provider_payout_item_id),
        provider_status = nullif(trim(p_provider_status), ''),
        processing_at = coalesce(processing_at, now()),
        updated_at = now()
    where id = v_payout.id;
  elsif p_status = 'completed' then
    insert into public.ledger_entries (creator_id, payout_id, type, amount_minor, currency)
    values (v_payout.creator_id, v_payout.id, 'reserve_release', v_payout.amount_minor, v_payout.currency)
    on conflict do nothing;

    insert into public.ledger_entries (creator_id, payout_id, type, amount_minor, currency, metadata)
    values (
      v_payout.creator_id,
      v_payout.id,
      'payout',
      -v_payout.recipient_amount_minor,
      v_payout.currency,
      jsonb_build_object('provider', 'paypal')
    )
    on conflict do nothing;

    if p_actual_fee_minor > 0 then
      insert into public.ledger_entries (creator_id, payout_id, type, amount_minor, currency, metadata)
      values (
        v_payout.creator_id,
        v_payout.id,
        'gateway_fee',
        -p_actual_fee_minor,
        v_payout.currency,
        jsonb_build_object('provider', 'paypal', 'kind', 'payout_fee')
      )
      on conflict do nothing;
    end if;

    update public.payouts
    set status = 'completed',
        provider_payout_item_id = coalesce(nullif(trim(p_provider_payout_item_id), ''), provider_payout_item_id),
        provider_status = nullif(trim(p_provider_status), ''),
        gateway_fee_minor = p_actual_fee_minor,
        completed_at = now(),
        updated_at = now()
    where id = v_payout.id;

    update public.payout_accounts set status = 'verified', updated_at = now()
    where id = v_payout.payout_account_id and status <> 'verified';

    insert into public.notifications (creator_id, type, title, body, related_payout_id)
    values (
      v_payout.creator_id,
      'payout_completed',
      'Retiro completado',
      'El dinero fue enviado a tu cuenta PayPal.',
      v_payout.id
    )
    on conflict (related_payout_id, type) where related_payout_id is not null do nothing
    returning id into v_notification_id;
  else
    insert into public.ledger_entries (creator_id, payout_id, type, amount_minor, currency)
    values (v_payout.creator_id, v_payout.id, 'reserve_release', v_payout.amount_minor, v_payout.currency)
    on conflict do nothing;

    update public.payouts
    set status = 'failed',
        provider_payout_item_id = coalesce(nullif(trim(p_provider_payout_item_id), ''), provider_payout_item_id),
        provider_status = nullif(trim(p_provider_status), ''),
        gateway_fee_minor = p_actual_fee_minor,
        failed_at = now(),
        failure_code = coalesce(nullif(trim(p_failure_code), ''), 'provider_failed'),
        updated_at = now()
    where id = v_payout.id;

    insert into public.notifications (creator_id, type, title, body, related_payout_id)
    values (
      v_payout.creator_id,
      'payout_failed',
      'No pudimos completar tu retiro',
      'Entra a TipMe para revisar el problema.',
      v_payout.id
    )
    on conflict (related_payout_id, type) where related_payout_id is not null do nothing
    returning id into v_notification_id;
  end if;

  update public.webhook_events
  set status = 'processed', processed_at = now()
  where provider = p_provider and provider_event_id = p_event_id;

  return query select true, v_notification_id, v_payout.creator_id, v_payout.id;
end;
$$;

revoke all on function public.transition_platform_payout_from_provider(text,text,uuid,text,text,text,bigint,text,text) from public;
grant execute on function public.transition_platform_payout_from_provider(text,text,uuid,text,text,text,bigint,text,text) to service_role;
