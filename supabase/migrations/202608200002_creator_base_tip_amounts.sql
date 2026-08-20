create or replace function public.confirm_tip_from_webhook(
  p_provider text,
  p_event_id text,
  p_payment_id text,
  p_payload_digest text,
  p_gateway_fee_minor bigint default null,
  p_provider_confirmed_at timestamptz default null
)
returns table (newly_processed boolean, notification_id uuid, creator_id uuid, tip_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tip public.tips%rowtype;
  v_notification_id uuid;
  v_inserted integer;
  v_creator_gateway_fee bigint;
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

  v_creator_gateway_fee := greatest(coalesce(p_gateway_fee_minor, 0) - v_tip.processing_support_minor, 0);
  v_net := greatest(v_tip.base_amount_minor - v_tip.platform_fee_minor - v_creator_gateway_fee, 0);

  update public.tips
  set status = 'confirmed', gateway_fee_minor = p_gateway_fee_minor, net_amount_minor = v_net,
      confirmed_at = coalesce(p_provider_confirmed_at, now())
  where id = v_tip.id;

  insert into public.ledger_entries (creator_id, tip_id, type, amount_minor, currency)
  values (v_tip.creator_id, v_tip.id, 'tip_confirmed', v_tip.base_amount_minor, v_tip.currency);

  if v_tip.platform_fee_minor > 0 then
    insert into public.ledger_entries (creator_id, tip_id, type, amount_minor, currency)
    values (v_tip.creator_id, v_tip.id, 'platform_fee', -v_tip.platform_fee_minor, v_tip.currency);
  end if;

  if v_creator_gateway_fee > 0 then
    insert into public.ledger_entries (creator_id, tip_id, type, amount_minor, currency)
    values (v_tip.creator_id, v_tip.id, 'gateway_fee', -v_creator_gateway_fee, v_tip.currency);
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

revoke all on function public.confirm_tip_from_webhook(text,text,text,text,bigint,timestamptz) from public;
grant execute on function public.confirm_tip_from_webhook(text,text,text,text,bigint,timestamptz) to service_role;

create or replace function public.creator_tip_totals(requested_creator uuid)
returns table (
  currency public.currency_code,
  gross_confirmed_minor bigint,
  platform_fees_minor bigint,
  gateway_fees_minor bigint,
  net_confirmed_minor bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is distinct from requested_creator and not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    t.currency,
    coalesce(sum(t.base_amount_minor), 0)::bigint,
    coalesce(sum(t.platform_fee_minor), 0)::bigint,
    coalesce(sum(greatest(coalesce(t.gateway_fee_minor, 0) - t.processing_support_minor, 0)), 0)::bigint,
    coalesce(sum(t.net_amount_minor), 0)::bigint
  from public.tips t
  where t.creator_id = requested_creator
    and t.status = 'confirmed'
  group by t.currency;
end;
$$;

revoke all on function public.creator_tip_totals(uuid) from public;
grant execute on function public.creator_tip_totals(uuid) to authenticated;
