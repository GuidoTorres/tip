begin;

alter table public.profiles
  add column social_url text;

alter table public.profiles
  add constraint profiles_social_url_format
  check (
    social_url is null
    or (
      char_length(social_url) between 1 and 2048
      and social_url ~ '^https?://'
    )
  );

drop function public.get_public_creator(text);

create function public.get_public_creator(requested_username text)
returns table (id uuid, public_name text, username text, avatar_url text, bio text, social_url text, country text, preferred_currency public.currency_code)
language sql stable security definer set search_path = '' as $$
  select p.id, p.public_name, p.username::text, p.avatar_url, p.bio, p.social_url, p.country, p.preferred_currency
  from public.profiles p
  where lower(p.username::text) = lower(trim(requested_username)) and p.onboarding_completed = true;
$$;

revoke all on function public.get_public_creator(text) from public;
grant execute on function public.get_public_creator(text) to anon, authenticated;

commit;
