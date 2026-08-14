# Withdrawn Total Design

## Goal

Show creators how much money has been successfully withdrawn without introducing an editable or duplicated financial total.

## Source of truth

The total is derived from immutable `ledger_entries` whose type is `payout`. These entries are created only when a payout reaches `completed`, so requested, processing, and failed payouts are excluded automatically.

## Currency handling

Amounts remain in integer minor units. Entries are grouped by ISO currency and currencies are never converted or added together. The preferred currency is shown first; any other currency with completed withdrawals is shown separately.

## UI

`/dashboard/payouts` adds a `Total retirado` summary near the available balance. The available balance remains the primary action metric. When no completed payout exists, the preferred currency total is displayed as zero.

## Security and scope

The authenticated creator reads only their own ledger rows through the existing RLS policy. No migration, writable total field, provider change, or payout-state change is required.

## Verification

A focused financial unit test covers completed payout summation, currency separation, absolute display values, and rejection of malformed positive payout movements. Then run the payout tests, typecheck, and lint.
