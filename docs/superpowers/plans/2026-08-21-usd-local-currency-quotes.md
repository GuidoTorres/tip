# USD to Local Mercado Pago Quotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep fan-selected tips in USD while securely charging and accounting in the creator's Mercado Pago currency.

**Architecture:** A server-side Mercado Pago quote service converts USD into the connected seller's local currency and signs a ten-minute quote. Payment creation verifies that quote, stores both the USD reference and local financial values, and keeps webhook, ledger, dashboard, and payouts entirely local.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase/PostgreSQL, Mercado Pago Payments API, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-21-usd-local-currency-quotes-design.md`

## Global Constraints

- Do not use Git or branches.
- No new dependency.
- Browser never chooses the rate, local currency, local amount, fee, or payment status.
- Existing tips remain readable.

---

### Task 1: Exchange-rate quote domain

**Files:**
- Create: `src/features/payments/mercadopago-exchange-rate.ts`
- Create: `src/lib/security/payment-quote.ts`
- Test: `tests/payments/mercadopago-exchange-rate.test.ts`
- Test: `tests/security/payment-quote.test.ts`

**Interfaces:**
- `getMercadoPagoExchangeRate({ accessToken, from, to, fetchImpl }): Promise<{ rate: number; quotedAt: string }>`
- `convertUsdMinorToLocalMinor(usdMinor, rate, currency): number`
- `createPaymentQuote(payload, secret): string`
- `verifyPaymentQuote(token, secret, now?): PaymentQuotePayload`

- [ ] Write tests proving literal USD conversions, provider-response validation, valid signatures, tampering rejection and ten-minute expiry; run them and observe failures.
- [ ] Implement only the four interfaces above; run focused tests until green.

### Task 2: Quote endpoint and public checkout

**Files:**
- Create: `src/app/api/payments/quote/route.ts`
- Modify: `src/components/tips/tip-form.tsx`
- Modify: `src/components/payments/mercadopago-card-checkout.tsx`
- Test: `tests/payments/payment-quote-route.test.ts`

**Interfaces:**
- `POST /api/payments/quote` consumes `{ username, amountUsdMinor }`.
- It returns `{ amountUsdMinor, localAmountMinor, currency, rate, quotedAt, quoteToken }` after resolving the connected account and OAuth credential server-side.

- [ ] Write route/service tests proving valid quotes and fail-closed behavior; run and observe failures.
- [ ] Implement the rate-limited route and update the form so presets/custom amount are always USD while Card Payment receives only the signed local quote amount.
- [ ] Show concise conversion disclosure and retry state; run focused tests until green.

### Task 3: Payment creation and persistence

**Files:**
- Create: `supabase/migrations/202608210002_usd_tip_quotes.sql`
- Modify: `src/features/payments/create-tip.ts`
- Modify: `src/features/payments/supabase-tip-repository.ts`
- Modify: `src/app/api/tips/route.ts`
- Test: `tests/payments/create-tip.test.ts`

**Interfaces:**
- Mercado Pago tip input adds `quoteToken`; free-form local amount/rate remain forbidden.
- `tips` adds nullable `display_amount_usd_minor`, `exchange_rate`, `exchange_rate_quoted_at`, `exchange_rate_source`.

- [ ] Write tests proving the signed local amount is charged, the fee is local, and altered/expired/wrong-creator quotes create no payment; run and observe failures.
- [ ] Add the backward-compatible migration, verify the quote inside `createTip`, and persist the USD reference plus local values.
- [ ] Run focused payment and webhook tests until green.

### Task 4: Receipt and final verification

**Files:**
- Modify: `src/app/tips/[tipId]/receipt/page.tsx`
- Modify: `src/app/dashboard/tips/[tipId]/page.tsx`
- Modify: `README.md`

- [ ] Display USD as the fan's selected reference and the local processed amount in receipt/detail while leaving dashboard totals local.
- [ ] Run `npm.cmd run typecheck`, `npm.cmd run lint`, relevant payment tests, and `npm.cmd run build`; fix every failure before reporting completion.
