begin;

-- Demo password: TipMe-Demo-2026! Change or remove this user outside local/demo projects.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'camila@demo.tipme.pro',
  crypt('TipMe-Demo-2026!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"locale":"es"}', now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  '11000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"camila@demo.tipme.pro","email_verified":true}',
  'email', now(), now(), now()
) on conflict (provider_id, provider) do nothing;

update public.profiles set
  public_name = 'Camila', username = 'camila', bio = 'Gracias por apoyar mi contenido ❤️',
  country = 'PE', preferred_currency = 'USD', locale = 'es', onboarding_completed = true
where id = '10000000-0000-4000-8000-000000000001';

insert into public.payout_accounts (id, creator_id, provider, provider_account_id, bank_name, last4, country, status)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'paypal', 'camila@demo.tipme.pro', 'PayPal', null, 'XX', 'pending')
on conflict (id) do nothing;

insert into public.tips (
  id, creator_id, payer_name, message, anonymous, base_amount_minor, processing_support_minor, amount_minor, currency,
  platform_fee_minor, gateway_fee_minor, net_amount_minor, provider, provider_payment_id, status, confirmed_at
) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Mateo', 'Para ti ❤️', false, 5000, 0, 5000, 'USD', 150, 200, 4650, 'mock', 'mock_demo_confirmed_1', 'confirmed', now() - interval '2 minutes'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', null, null, true, 2000, 0, 2000, 'USD', 60, null, 1940, 'mock', 'mock_demo_confirmed_2', 'confirmed', now() - interval '10 minutes'),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Lucía', 'Sigue creando', false, 3500, 0, 3500, 'USD', 105, null, 3395, 'mock', 'mock_demo_pending_1', 'pending', null)
on conflict (id) do nothing;

insert into public.ledger_entries (creator_id, tip_id, type, amount_minor, currency) values
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'tip_confirmed', 5000, 'USD'),
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'platform_fee', -150, 'USD'),
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'gateway_fee', -200, 'USD'),
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'tip_confirmed', 2000, 'USD'),
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'platform_fee', -60, 'USD')
on conflict do nothing;

insert into public.notifications (creator_id, type, title, body, related_tip_id) values
  ('10000000-0000-4000-8000-000000000001', 'tip_confirmed', 'Nuevo tip confirmado', 'Mateo te envió un tip', '30000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001', 'tip_confirmed', 'Nuevo tip confirmado', 'Alguien te envió un tip', '30000000-0000-4000-8000-000000000002')
on conflict do nothing;

commit;
