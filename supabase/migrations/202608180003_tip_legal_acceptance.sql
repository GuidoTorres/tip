alter table public.tips
  add column legal_terms_version text,
  add column legal_accepted_at timestamptz;

alter table public.tips
  add constraint tips_legal_acceptance_complete check (
    (legal_terms_version is null and legal_accepted_at is null)
    or (legal_terms_version is not null and legal_accepted_at is not null)
  ),
  add constraint tips_legal_terms_version_length check (
    legal_terms_version is null or char_length(legal_terms_version) between 1 and 32
  );
