-- Fix payout ledger writes in databases that already ran the platform payout migration.
-- OUT parameters from RETURNS TABLE are PL/pgSQL variables, so naming payout_id in
-- an ON CONFLICT inference clause is ambiguous. The existing partial unique index
-- still guarantees one ledger entry per payout and type.

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
