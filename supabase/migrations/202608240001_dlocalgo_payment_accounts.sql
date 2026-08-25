-- dLocal Go identifica a cada creadora con un split_code de contrato, no con un merchant id.
-- Se guarda en la misma columna provider_merchant_id: sigue siendo el identificador que el
-- proveedor exige al cobrar, y conserva la unicidad (provider, provider_merchant_id).
alter table public.payment_accounts
  drop constraint if exists payment_accounts_provider_valid;

alter table public.payment_accounts
  add constraint payment_accounts_provider_valid check (provider in ('paypal', 'mercadopago', 'dlocalgo'));
