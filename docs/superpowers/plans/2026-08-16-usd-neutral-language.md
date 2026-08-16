# USD-Only Operations and Neutral Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Force every new TipMe financial operation to USD and replace gendered user-facing language with natural neutral Spanish.

**Architecture:** Keep the existing multi-currency domain and database columns for traceability, but introduce one application-level currency constant (`USD`) used at every creation boundary. Existing financial rows remain untouched; a forward migration only changes profile preferences for future operations. UI selectors disappear and server-side services reject or ignore non-USD input.

**Tech Stack:** Next.js App Router, TypeScript, Zod, Supabase PostgreSQL, Vitest.

## Global Constraints

- USD is the only currency for new profiles, tips, balances selected by the application, and payouts.
- Money remains integer minor units; no floats and no FX conversion.
- Existing tips, ledger entries, and payouts must never be relabeled.
- Keep `currency`, `Currency`, and `PaymentProvider` currency parameters for traceability and future expansion.
- Use naturally neutral Spanish; do not add gender fields or rewrite technical identifiers such as `creator_id`.
- Do not use Git or branches.

---

### Task 1: Application currency boundary

**Files:**
- Create: `src/features/payments/application-currency.ts`
- Modify: `src/features/payments/create-tip.ts`
- Modify: `src/features/payouts/service.ts`
- Test: `tests/payments/create-tip.test.ts`
- Test: `tests/payouts/payouts.test.ts`

**Interfaces:**
- Produces: `APPLICATION_CURRENCY: Currency` with the literal value `USD`.
- Consumes: existing `Currency`, `createTip`, and `requestPayout` interfaces.

- [ ] Add a create-tip test where the repository returns an EUR profile and assert both the stored tip and provider payment use USD.
- [ ] Run `npm test -- tests/payments/create-tip.test.ts` and verify the test fails because EUR is currently propagated.
- [ ] Add a payout test that passes EUR and assert `requestPayout` rejects before repository/provider calls.
- [ ] Run `npm test -- tests/payouts/payouts.test.ts` and verify the test fails because EUR is currently accepted.
- [ ] Create `APPLICATION_CURRENCY` and use it in `createTip`; restrict the payout request schema to `z.literal(APPLICATION_CURRENCY)`.
- [ ] Run both focused test files and verify they pass.

### Task 2: Profiles and USD-only interface

**Files:**
- Modify: `src/features/profiles/actions.ts`
- Modify: `src/app/onboarding/page.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`
- Modify: `src/app/[username]/page.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/payouts/page.tsx`
- Test: `tests/ui/usd-only-interface.test.ts`

**Interfaces:**
- Consumes: `APPLICATION_CURRENCY` from Task 1.
- Produces: forms without an editable `currency` control and server actions that always persist USD.

- [ ] Write a source-level UI regression test asserting onboarding/settings have no currency selector and the actions assign `preferred_currency: APPLICATION_CURRENCY`.
- [ ] Run `npm test -- tests/ui/usd-only-interface.test.ts` and verify it fails against the current selectors.
- [ ] Remove currency from `profileSchema` and form parsing; assign `preferred_currency: APPLICATION_CURRENCY` in both profile actions.
- [ ] Replace onboarding/settings selectors with a non-editable `Moneda: USD` presentation.
- [ ] Use `APPLICATION_CURRENCY` for public tips, dashboard balance selection, dashboard totals, and withdrawal balance selection.
- [ ] Keep historical payout rows formatted using their stored `payout.currency`.
- [ ] Run the focused UI test and the existing payment/payout tests.

### Task 3: Safe forward database migration

**Files:**
- Create: `supabase/migrations/202608160001_set_application_currency_usd.sql`
- Modify: `tests/database/migration-safety.test.ts`

**Interfaces:**
- Produces: an idempotent profile-preference migration.
- Does not mutate: `tips`, `ledger_entries`, or `payouts`.

- [ ] Extend the migration-safety test to require the USD migration, an update limited to `public.profiles`, and no update of financial tables.
- [ ] Run `npm test -- tests/database/migration-safety.test.ts` and verify it fails because the migration does not exist.
- [ ] Add SQL containing only `update public.profiles set preferred_currency = 'USD' where preferred_currency <> 'USD';` plus a descriptive comment.
- [ ] Run the migration-safety test and verify it passes.

### Task 4: Neutral user-facing copy

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/[username]/page.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/components/tips/receipt-status.tsx`
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/admin/creators/page.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `README.md`
- Test: `tests/ui/neutral-language.test.ts`

**Interfaces:**
- Produces: neutral Spanish copy without changing `creator` domain identifiers.

- [ ] Add a regression test scanning user-facing source files for `creadora`, `creadoras`, and `Bienvenida de vuelta`.
- [ ] Run `npm test -- tests/ui/neutral-language.test.ts` and verify it fails on current copy.
- [ ] Replace copy with `Qué bueno verte de nuevo`, `Perfil no encontrado`, `Tu cuenta`, `El dashboard de TipMe es la fuente de verdad`, and neutral admin labels such as `Perfiles`.
- [ ] Rewrite the README product description and operational prose neutrally while leaving technical identifiers intact.
- [ ] Run the neutral-language test and relevant receipt test.

### Task 5: Verification and handoff

**Files:**
- Modify if required by failures: only files already listed above.

- [ ] Run `npm test` and correct regressions without weakening financial assertions.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Report the new migration file that must be executed in Supabase SQL Editor before production testing.
- [ ] Remind that Vercel requires a redeploy after pushing the updated project.
