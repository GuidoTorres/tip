begin;

alter table public.profiles
  add column content_category text;

alter table public.profiles
  add column creator_policy_version text;

alter table public.profiles
  add column creator_policy_accepted_at timestamptz;

alter table public.profiles
  add column payment_review_status text not null default 'pending';

alter table public.profiles
  add column payment_review_reason text;

alter table public.profiles
  add column payment_reviewed_at timestamptz;

alter table public.profiles
  add column payment_reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.profiles
  add constraint profiles_content_category check (
    content_category is null
    or content_category in ('livestreaming', 'short_video', 'music', 'gaming', 'education', 'other')
  ),
  add constraint profiles_creator_policy_version_length check (
    creator_policy_version is null or char_length(creator_policy_version) between 1 and 40
  ),
  add constraint profiles_payment_review_status check (
    payment_review_status in ('pending', 'approved', 'rejected', 'suspended')
  ),
  add constraint profiles_payment_review_reason_length check (
    payment_review_reason is null or char_length(payment_review_reason) between 3 and 500
  );

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

  if new.public_name is distinct from old.public_name
    or new.username is distinct from old.username
    or new.avatar_url is distinct from old.avatar_url
    or new.bio is distinct from old.bio
    or new.social_url is distinct from old.social_url
    or new.content_category is distinct from old.content_category
    or new.creator_policy_version is distinct from old.creator_policy_version
    or new.creator_policy_accepted_at is distinct from old.creator_policy_accepted_at
  then
    new.payment_review_status := 'pending';
    new.payment_review_reason := null;
    new.payment_reviewed_at := null;
    new.payment_reviewed_by := null;
  end if;

  return new;
end;
$$;

create trigger profiles_protect_payment_review
before update on public.profiles
for each row execute function public.protect_profile_payment_review();

create or replace function public.review_creator_policy(
  requested_creator uuid,
  requested_status text,
  requested_reason text,
  requested_admin uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if requested_status not in ('approved', 'rejected', 'suspended') then
    raise exception 'invalid_creator_review_status';
  end if;

  if requested_reason is null or char_length(trim(requested_reason)) not between 3 and 500 then
    raise exception 'invalid_creator_review_reason';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = requested_admin and role = 'admin'
  ) then
    raise exception 'admin_required';
  end if;

  update public.profiles
  set payment_review_status = requested_status,
      payment_review_reason = trim(requested_reason),
      payment_reviewed_at = now(),
      payment_reviewed_by = requested_admin
  where id = requested_creator and role = 'creator';

  if not found then
    raise exception 'creator_not_found';
  end if;

  insert into public.admin_audit_logs (admin_id, action, target_type, target_id, metadata)
  values (
    requested_admin,
    'creator_policy_reviewed',
    'profile',
    requested_creator,
    jsonb_build_object('status', requested_status, 'reason', trim(requested_reason))
  );
end;
$$;

revoke all on function public.review_creator_policy(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.review_creator_policy(uuid,text,text,uuid) to service_role;

drop function public.get_public_creator(text);

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
  select
    p.id,
    p.public_name,
    p.username::text,
    p.avatar_url,
    p.bio,
    p.social_url,
    p.content_category,
    p.country,
    p.preferred_currency,
    p.payment_review_status in ('approved')
      and p.content_category is not null
      and p.social_url is not null
      and p.creator_policy_version = '2026-09-07'
      and p.creator_policy_accepted_at is not null
  from public.profiles p
  where lower(p.username::text) = lower(trim(requested_username))
    and p.onboarding_completed = true;
$$;

revoke all on function public.get_public_creator(text) from public;
grant execute on function public.get_public_creator(text) to anon, authenticated, service_role;

grant update (social_url, content_category, creator_policy_version, creator_policy_accepted_at)
on public.profiles to authenticated;

commit;
