# PayPal Standard Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exercise real PayPal Sandbox checkout, capture, verified webhook, TipMe ledger, balance, receipt, and push without Multiparty credentials.

**Architecture:** Add an explicit, Sandbox-only single-merchant mode at the environment boundary. The PayPal adapter selects standard Orders payloads in that mode, while the existing Multiparty payload remains unchanged; checkout confirmation continues to depend solely on verified webhooks.

**Tech Stack:** Next.js 16, TypeScript, React 19, Supabase, PayPal REST/JavaScript SDK, Zod, Vitest.

## Global Constraints

- The fallback requires `PAYPAL_ENVIRONMENT=sandbox` and `PAYPAL_SANDBOX_SINGLE_MERCHANT=true`.
- Configuration must reject the fallback with `PAYPAL_ENVIRONMENT=live`.
- No BN header or SDK attribute is sent when the BN Code is absent.
- Standard orders omit partner assertion, creator payee, and PayPal platform fee.
- The browser never confirms a tip; the verified webhook remains authoritative.
- Mock and Multiparty behavior must remain functional.
- No Git branches or commits; the user requested local work only.

---

### Task 1: Safe environment mode

**Files:**
- Modify: `src/lib/env/server.ts`
- Modify: `.env.example`
- Test: `tests/domain/runtime.test.ts`

**Interfaces:**
- Produces `ServerEnv.PAYPAL_SANDBOX_SINGLE_MERCHANT: boolean`.
- Produces `ServerEnv.PAYPAL_PARTNER_ATTRIBUTION_ID: string` with an empty default.

- [ ] Add tests that parse the fallback in Sandbox and reject it in live.
- [ ] Run `npm.cmd test -- tests/domain/runtime.test.ts` and observe the expected failure.
- [ ] Add the boolean environment field and a `superRefine` rule for the live-mode prohibition.
- [ ] Make the BN Code optional and document both fields in `.env.example`.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Standard and Multiparty PayPal requests

**Files:**
- Modify: `src/features/payments/paypal-client.ts`
- Modify: `src/features/payments/paypal-provider.ts`
- Modify: `src/features/payments/provider.ts`
- Modify: `src/features/payments/create-tip.ts`
- Modify: `src/app/api/tips/route.ts`
- Modify: `src/features/payments/capture-tip.ts`
- Test: `tests/payments/paypal-provider.test.ts`
- Test: `tests/payments/create-tip.test.ts`
- Test: `tests/payments/capture-tip.test.ts`

**Interfaces:**
- `PayPalConfig.singleMerchantSandbox` selects standard behavior.
- `PayPalClient.createOrder(input)` and `captureOrder(...)` omit merchant impersonation in standard mode.
- Standard mode uses `PAYPAL_PARTNER_MERCHANT_ID` as its test merchant and does not require `payment_accounts`.

- [ ] Add failing tests asserting no BN header, auth assertion, `payee`, or `platform_fees` in standard mode.
- [ ] Add failing tests that standard mode creates and captures a tip without a connected creator account.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Make partner attribution optional in config and REST headers.
- [ ] Branch only the Orders/capture request construction: standard mode uses platform credentials directly; Multiparty keeps creator merchant assertion, payee, and fee.
- [ ] Resolve the platform Sandbox merchant in create/capture services only when the explicit fallback is active.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Sandbox onboarding disclosure and SDK

**Files:**
- Create: `src/components/payments/paypal-sandbox-account.tsx`
- Modify: `src/app/onboarding/page.tsx`
- Modify: `src/components/payments/paypal-sdk.ts`
- Modify: `src/features/payments/provider.ts`
- Modify: `src/features/payments/paypal-provider.ts`
- Test: `tests/ui/paypal-standard-sandbox.test.tsx`

**Interfaces:**
- `PayPalSandboxAccount` explains that creator connection and fee split are simulated.
- Embedded checkout accepts `partnerAttributionId?: string` and omits `data-partner-attribution-id` when absent.

- [ ] Add a failing static UI test for the Sandbox disclosure and absence of a real connect button.
- [ ] Add a unit test for building SDK attributes without a BN Code.
- [ ] Run focused tests and confirm the expected failures.
- [ ] Render the disclosure with a Continue link when fallback is active; preserve `PayPalConnect` for Multiparty.
- [ ] Make the SDK BN attribute conditional while keeping Card Fields and PayPal button behavior unchanged.
- [ ] Run focused UI tests and confirm they pass.

### Task 4: Documentation and verification

**Files:**
- Modify: `README.md`
- Modify: `docs/manual/pilot-checklist.md`

**Interfaces:**
- Documents exact Sandbox-only configuration and limitations.

- [ ] Document `PAYPAL_SANDBOX_SINGLE_MERCHANT=true`, empty BN Code, real webhook flow, and simulated seller/fee split.
- [ ] Run `npm.cmd test` and require zero failures.
- [ ] Run `npm.cmd run typecheck` and require exit code 0.
- [ ] Run `npm.cmd run lint` and require exit code 0 with no warnings.
- [ ] Run `npm.cmd run build` and require exit code 0.
- [ ] Report external steps separately: Supabase migration, webhook configuration, Vercel variables, and a PayPal Sandbox buyer test.
