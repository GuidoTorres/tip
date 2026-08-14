# Withdrawn Total Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. No subagents and no Git operations are permitted for this workspace.

**Goal:** Show the authenticated creator's completed withdrawal total on the payouts page, derived from immutable ledger movements and separated by currency.

**Architecture:** Add a pure money projection that validates completed payout movements and groups their absolute minor-unit values by currency. The payouts server page reads the creator's existing `payout` ledger entries through RLS and renders the preferred currency first, followed by any other withdrawn currencies.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase/PostgreSQL RLS, Vitest, Tailwind CSS.

## Global Constraints

- Count only immutable ledger entries with `type = payout`.
- Never mix or convert currencies.
- Keep all values as safe integer minor units.
- Display zero in the preferred currency when no completed withdrawal exists.
- Do not add dependencies, migrations, editable totals, Git operations, or provider changes.

---

### Task 1: Ledger-derived withdrawn totals

**Files:**
- Modify: `src/features/ledger/money.ts`
- Modify: `tests/domain/money.test.ts`
- Modify: `src/app/dashboard/payouts/page.tsx`

**Interfaces:**
- Consumes: ledger projections shaped as `{ amountMinor: number; currency: Currency }`, where completed payout amounts are negative.
- Produces: `sumWithdrawnByCurrency(entries): Partial<Record<Currency, number>>`, containing positive display totals in minor units.

- [ ] **Step 1: Write the failing financial tests**

Add literal assertions covering grouping, accumulation, empty input, and malformed movements:

```ts
expect(sumWithdrawnByCurrency([
  { amountMinor: -1_000, currency: "USD" },
  { amountMinor: -500, currency: "USD" },
  { amountMinor: -2_000, currency: "PEN" },
])).toEqual({ USD: 1_500, PEN: 2_000 });
expect(sumWithdrawnByCurrency([])).toEqual({});
expect(() => sumWithdrawnByCurrency([{ amountMinor: 100, currency: "USD" }])).toThrow("payout ledger amount must be negative");
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm.cmd test -- tests/domain/money.test.ts --maxWorkers=1`

Expected: FAIL because `sumWithdrawnByCurrency` is not exported.

- [ ] **Step 3: Implement the pure projection**

Validate that each movement is a safe negative integer, then accumulate `Math.abs(amountMinor)` under its ISO currency key. Return an empty object for no movements.

- [ ] **Step 4: Render the ledger-derived metric**

Extend the existing parallel query in `/dashboard/payouts` with:

```ts
supabase
  .from("ledger_entries")
  .select("amount_minor,currency")
  .eq("creator_id", user.id)
  .eq("type", "payout")
```

Map the rows into `sumWithdrawnByCurrency`. Render `Total retirado` below the available balance, always including the preferred currency and showing other non-zero currencies separately.

- [ ] **Step 5: Verify the focused and project checks**

Run sequentially:

```powershell
npm.cmd test -- tests/domain/money.test.ts --maxWorkers=1
npm.cmd test -- tests/payouts/payouts.test.ts --maxWorkers=1
npm.cmd run typecheck
npm.cmd run lint
```

Expected: every command exits with code 0.
