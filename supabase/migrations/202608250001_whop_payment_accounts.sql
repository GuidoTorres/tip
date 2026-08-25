-- Whop App installations use the creator's own Whop company (biz_...).
-- TipMe does not custody or transfer those funds.
alter table public.payment_accounts
  drop constraint if exists payment_accounts_provider_valid;

alter table public.payment_accounts
  add constraint payment_accounts_provider_valid
  check (provider in ('paypal', 'mercadopago', 'dlocalgo', 'whop'));
