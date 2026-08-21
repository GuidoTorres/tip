-- Extend Mercado Pago Split Payments 1:1 to every currently supported regional market.
alter type public.currency_code add value if not exists 'UYU';

alter table public.payment_accounts
  drop constraint if exists payment_accounts_country_valid,
  drop constraint if exists payment_accounts_region_complete;

alter table public.payment_accounts
  add constraint payment_accounts_country_valid check (
    provider_country is null or provider_country in ('AR', 'BR', 'CL', 'CO', 'MX', 'PE', 'UY')
  ),
  add constraint payment_accounts_region_complete check (
    provider <> 'mercadopago' or
    (provider_country = 'AR' and provider_currency::text = 'ARS') or
    (provider_country = 'BR' and provider_currency::text = 'BRL') or
    (provider_country = 'CL' and provider_currency::text = 'CLP') or
    (provider_country = 'CO' and provider_currency::text = 'COP') or
    (provider_country = 'MX' and provider_currency::text = 'MXN') or
    (provider_country = 'PE' and provider_currency::text = 'PEN') or
    (provider_country = 'UY' and provider_currency::text = 'UYU')
  );
