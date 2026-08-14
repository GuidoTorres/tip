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
5. `request_payout` rejects any amount above available USD balance.
6. Direct update or deletion of any ledger entry fails.

For a hosted project, run `supabase db push` after linking the project. Never apply the demo seed to production.
