-- Human-readable, gateway-independent references for verifying tip receipts.
-- The random value does not expose tip volume, creator identity, or provider IDs.

create or replace function public.generate_tip_operation_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'TM-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
$$;

revoke all on function public.generate_tip_operation_code() from public;
grant execute on function public.generate_tip_operation_code() to service_role;

alter table public.tips
  add column if not exists operation_code text;

update public.tips
set operation_code = public.generate_tip_operation_code()
where operation_code is null;

alter table public.tips
  alter column operation_code set default public.generate_tip_operation_code(),
  alter column operation_code set not null;

create unique index if not exists tips_operation_code_unique_idx
on public.tips (operation_code);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tips_operation_code_format'
  ) then
    alter table public.tips
      add constraint tips_operation_code_format
      check (operation_code ~ '^TM-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$');
  end if;
end;
$$;
