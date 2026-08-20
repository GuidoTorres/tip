# Database verification

Run this after installing Supabase CLI and Docker:

```powershell
supabase start
supabase db reset
```

Verify in Supabase Studio:

1. Sign in as `camila@demo.tipme.pro` with `TipMe-Demo-2026!`.
2. `creator_balances` returns USD available `6590` and pending `3395`.
3. Replaying the same `provider_event_id` through `confirm_tip_from_webhook` returns `newly_processed=false`.
4. A second authenticated creator cannot select Camila's tips, ledger, payouts, notifications, or subscriptions.
5. `request_platform_payout` rejects any amount above available USD balance and cannot be executed with an authenticated browser token.
6. Direct update or deletion of any ledger entry fails.
7. Saving a PayPal email through `set_my_paypal_payout_email` creates it as `pending`; an authenticated user cannot change it to `verified` directly.
8. A completed PayPal payout creates exactly one `reserve_release`, one `payout`, at most one `gateway_fee`, and one logical notification even if its webhook is repeated.
9. A failed payout releases the full reserve and does not debit the recipient amount.

For the hosted project, apply `supabase/migrations/202608200001_paypal_platform_payouts.sql` in the SQL Editor (or use `supabase db push` after linking). Verify that the new columns exist on `tips` and `payouts` before deploying the matching application code.

For a hosted project, run `supabase db push` after linking the project. Never apply the demo seed to production.
