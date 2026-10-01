begin;

-- The public function has a shorter return row on older installations.
-- Require the profile columns before replacing it, so a skipped prerequisite
-- fails without changing the existing function or trigger.
do $$
begin
  if (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name in (
        'content_category', 'creator_policy_version', 'creator_policy_accepted_at',
        'payment_review_status', 'payment_review_reason',
        'payment_reviewed_at', 'payment_reviewed_by'
      )
  ) <> 7 then
    raise exception 'Missing creator policy migration'
      using hint = 'Apply 202609070001_creator_policy_readiness.sql before this migration.';
  end if;
end;
$$;

-- Pending review is no longer a payment activation gate. Preserve explicit
-- moderation when creators edit their profile: editing must not undo a block.
create or replace function public.protect_profile_payment_review()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if jwt_role <> 'service_role' and (
    new.payment_review_status is distinct from old.payment_review_status
    or new.payment_review_reason is distinct from old.payment_review_reason
    or new.payment_reviewed_at is distinct from old.payment_reviewed_at
    or new.payment_reviewed_by is distinct from old.payment_reviewed_by
  ) then
    raise exception 'payment_review_fields_are_server_controlled';
  end if;

  if old.payment_review_status not in ('rejected', 'suspended') and (
    new.public_name is distinct from old.public_name
    or new.username is distinct from old.username
    or new.avatar_url is distinct from old.avatar_url
    or new.bio is distinct from old.bio
    or new.social_url is distinct from old.social_url
    or new.content_category is distinct from old.content_category
    or new.creator_policy_version is distinct from old.creator_policy_version
    or new.creator_policy_accepted_at is distinct from old.creator_policy_accepted_at
  ) then
    new.payment_review_status := 'pending';
    new.payment_review_reason := null;
    new.payment_reviewed_at := null;
    new.payment_reviewed_by := null;
  end if;
  return new;
end;
$$;

-- PostgreSQL cannot change OUT parameters with CREATE OR REPLACE.
-- Recreate within this transaction and restore grants below, without CASCADE.
drop function if exists public.get_public_creator(text);

create function public.get_public_creator(requested_username text)
returns table (
  id uuid,
  public_name text,
  username text,
  avatar_url text,
  bio text,
  social_url text,
  content_category text,
  country text,
  preferred_currency public.currency_code,
  can_accept_tips boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.public_name, p.username::text, p.avatar_url, p.bio,
    p.social_url, p.content_category, p.country, p.preferred_currency,
    p.payment_review_status in ('pending', 'approved')
  from public.profiles p
  where lower(p.username::text) = lower(trim(requested_username))
    and p.onboarding_completed = true;
$$;

revoke all on function public.get_public_creator(text) from public;
grant execute on function public.get_public_creator(text) to anon, authenticated, service_role;

commit;
