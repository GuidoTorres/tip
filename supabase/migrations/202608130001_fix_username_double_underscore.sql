begin;

alter table public.profiles
  drop constraint if exists profiles_username_no_double_underscore;

alter table public.profiles
  add constraint profiles_username_no_double_underscore
  check (username is null or position('__' in username::text) = 0);

commit;
