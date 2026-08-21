alter table public.tips
  add column if not exists display_amount_usd_minor bigint,
  add column if not exists exchange_rate numeric(20,10),
  add column if not exists exchange_rate_quoted_at timestamptz,
  add column if not exists exchange_rate_source text;

alter table public.tips
  add constraint tips_display_amount_usd_positive
    check (display_amount_usd_minor is null or display_amount_usd_minor > 0),
  add constraint tips_exchange_rate_positive
    check (exchange_rate is null or exchange_rate > 0),
  add constraint tips_exchange_quote_complete
    check (
      (display_amount_usd_minor is null and exchange_rate is null and exchange_rate_quoted_at is null and exchange_rate_source is null)
      or
      (display_amount_usd_minor is not null and exchange_rate is not null and exchange_rate_quoted_at is not null and exchange_rate_source = 'mercadopago')
    );
