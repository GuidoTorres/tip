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
    coalesce(sum(t.amount_minor), 0)::bigint,
    coalesce(sum(t.platform_fee_minor), 0)::bigint,
    coalesce(sum(t.gateway_fee_minor), 0)::bigint,
    coalesce(sum(t.net_amount_minor), 0)::bigint
  from public.tips t
  where t.creator_id = requested_creator
    and t.status = 'confirmed'
  group by t.currency;
end;
$$;

revoke all on function public.creator_tip_totals(uuid) from public;
grant execute on function public.creator_tip_totals(uuid) to authenticated;
