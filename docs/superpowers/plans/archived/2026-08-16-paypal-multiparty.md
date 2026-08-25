# PayPal Multiparty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional PayPal Multiparty sandbox integration with connected creators, embedded card fields, PayPal wallet checkout, verified webhooks, and direct-to-creator funds.

**Architecture:** Extend the existing `PaymentProvider` boundary with asynchronous webhook verification and embedded checkout metadata. A small fetch-based PayPal REST client handles OAuth, partner assertions, orders, capture, seller onboarding, and webhook verification; existing Supabase RPCs remain the only path that confirms tips, writes ledger entries, and creates notifications.

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19, Supabase/PostgreSQL/RLS, PayPal REST APIs and JavaScript SDK Card Fields, Vitest, Zod.

## Global Constraints

- Keep `PAYMENT_PROVIDER=mock` functional without PayPal credentials.
- `PAYMENT_PROVIDER=paypal` uses Sandbox unless `PAYPAL_ENVIRONMENT=live` is explicit.
- Do not process live money before PayPal approves Multiparty, Partner Fee, and advanced card payments.
- Keep USD-only payment amounts in integer minor units.
- The browser never confirms a tip or writes financial state.
- Do not store card data, CVV, bank data, creator PayPal tokens, or identity documents.
- Use no new runtime dependency; use native `fetch` and the PayPal JavaScript SDK.
- Preserve webhook idempotency, anonymous payer privacy, and push-after-confirmation behavior.
- Do not use Git branches or commits; the user requested local file work only.

---

### Task 1: Database model and provider-neutral receipt secret

**Files:**
- Create: `supabase/migrations/202608160002_paypal_payment_accounts.sql`
- Modify: `src/lib/env/server.ts`
- Modify: `src/lib/security/receipt.ts`
- Modify: `src/app/api/tips/[tipId]/status/route.ts`
- Modify: `.env.example`
- Test: `tests/database/migration-safety.test.ts`
- Test: `tests/domain/runtime.test.ts`

**Interfaces:**
- Produces table `payment_accounts` and nullable `tips.provider_capture_id`.
- Produces `ServerEnv.RECEIPT_SIGNING_SECRET` and PayPal configuration fields.

- [ ] Add failing assertions that the migration enables RLS, grants creator read-only access, restricts writes to service role, and creates unique provider order/capture indexes.
- [ ] Run `npm.cmd test -- tests/database/migration-safety.test.ts tests/domain/runtime.test.ts` and confirm failure because PayPal schema/config is absent.
- [ ] Add the migration with `payment_account_status`, `payment_accounts`, indexes, timestamp trigger, RLS policy, service-role grants, and `tips.provider_capture_id`.
- [ ] Extend the environment schema exactly as follows:

```ts
PAYMENT_PROVIDER: z.enum(["mock", "paypal", "nuvei", "ebanx", "dlocal"]).default("mock"),
PAYPAL_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),
NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().min(1).default("fake-paypal-client-id-replace-me"),
PAYPAL_CLIENT_SECRET: z.string().min(1).default("fake-paypal-client-secret-replace-me"),
PAYPAL_WEBHOOK_ID: z.string().min(1).default("fake-paypal-webhook-id-replace-me"),
PAYPAL_PARTNER_MERCHANT_ID: z.string().min(1).default("fake-paypal-partner-merchant-id-replace-me"),
PAYPAL_PARTNER_ATTRIBUTION_ID: z.string().min(1).default("fake-paypal-bn-code-replace-me"),
RECEIPT_SIGNING_SECRET: z.string().min(16).default("fake-receipt-signing-secret-change-me"),
```

- [ ] Switch receipt status authorization from `MOCK_WEBHOOK_SECRET` to `RECEIPT_SIGNING_SECRET` and add fake `.env.example` values.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: PayPal REST client and provider contract

**Files:**
- Create: `src/features/payments/paypal-client.ts`
- Create: `src/features/payments/paypal-provider.ts`
- Modify: `src/features/payments/provider.ts`
- Modify: `src/features/payments/mock-provider.ts`
- Modify: `src/features/payments/provider-factory.ts`
- Test: `tests/payments/paypal-provider.test.ts`
- Modify: `tests/payments/mock-provider.test.ts`
- Modify: `tests/payments/create-tip.test.ts`
- Modify: `tests/payments/process-webhook.test.ts`
- Modify: `tests/payouts/payouts.test.ts`

**Interfaces:**
- Produces `WebhookVerificationInput = { rawBody: string; headers: Headers }`.
- Produces `PaymentResult.checkout` as `{ kind: "redirect"; url: string } | { kind: "embedded"; clientId: string; merchantId: string; clientToken: string }`.
- Produces `PayPalClient.createOrder`, `captureOrder`, `generateClientToken`, `verifyWebhook`, `createPartnerReferral`, and `getMerchantIntegration`.
- Produces `PayPalPaymentProvider` using injected `fetch` for deterministic tests.

- [ ] Write failing tests for sandbox URL selection, partner auth assertion, integer-to-USD formatting, creator payee, optional platform fee, safe capture parsing, webhook verification, event mapping, and provider factory selection.
- [ ] Run the PayPal/provider tests and confirm failure because the provider does not exist and webhook verification is synchronous.
- [ ] Change the provider contract to:

```ts
verifyWebhook(input: WebhookVerificationInput): Promise<boolean>;
parseWebhook(rawBody: string): Promise<PaymentWebhookEvent>;
capturePayment(input: { providerPaymentId: string; providerAccountId: string; idempotencyKey: string }): Promise<{ status: "pending" | "captured" | "rejected"; providerCaptureId: string | null }>;
```

- [ ] Implement a dependency-free PayPal client with Basic OAuth, cached access tokens, constant sandbox/live base URLs, `PayPal-Request-Id`, `PayPal-Partner-Attribution-Id`, and unsigned `PayPal-Auth-Assertion` generated from the platform client ID and connected merchant ID.
- [ ] Implement order payloads with `intent: CAPTURE`, USD value, `payee.merchant_id`, `NO_SHIPPING`, `PAY_NOW`, `INSTANT` disbursement, custom TipMe/tip identifiers, and `platform_fees` only when non-zero.
- [ ] Implement PayPal webhook verification by sending the unmodified parsed webhook event and all required PayPal transmission headers to `/v1/notifications/verify-webhook-signature`.
- [ ] Implement capture-event parsing with order ID, capture ID, actual PayPal fee when supplied, and the status mappings in the approved design.
- [ ] Adapt the mock provider and existing test doubles to the asynchronous interface without changing mock behavior.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Connected-account repository and PayPal onboarding

**Files:**
- Create: `src/features/payments/payment-account-repository.ts`
- Create: `src/features/payments/paypal-onboarding.ts`
- Create: `src/app/api/paypal/onboarding/route.ts`
- Create: `src/app/api/paypal/onboarding/callback/route.ts`
- Create: `src/components/payments/paypal-connect.tsx`
- Modify: `src/app/onboarding/page.tsx`
- Modify: `src/features/profiles/actions.ts`
- Test: `tests/payments/paypal-onboarding.test.ts`

**Interfaces:**
- Produces `PaymentAccountRepository.findConnected(creatorId, provider)`.
- Produces `startPayPalOnboarding(creatorId)` and `completePayPalOnboarding(creatorId, merchantId)`.

- [ ] Write failing tests proving that callback query parameters alone cannot mark an account connected and that verified PayPal capability data can.
- [ ] Run the onboarding tests and confirm expected failures.
- [ ] Implement a service-role repository that stores only merchant ID and verified booleans/status.
- [ ] Implement the authenticated start endpoint that creates a Partner Referrals URL containing `PAYMENT`, `REFUND`, and `PARTNER_FEE`, plus the configured return URL.
- [ ] Implement the authenticated callback that verifies returned state, queries PayPal merchant integration status, upserts `payment_accounts`, and redirects to onboarding step 3 only when receivable/onboarding requirements pass.
- [ ] Render mock payout setup only in mock mode and `Conectar PayPal` plus connection status only in PayPal mode.
- [ ] Run focused tests, typecheck, and lint for onboarding files.

### Task 4: PayPal order creation and safe capture

**Files:**
- Modify: `src/features/payments/create-tip.ts`
- Modify: `src/features/payments/supabase-tip-repository.ts`
- Modify: `src/app/api/tips/route.ts`
- Create: `src/features/payments/capture-tip.ts`
- Create: `src/app/api/paypal/tips/[tipId]/capture/route.ts`
- Modify: `src/lib/security/receipt.ts`
- Test: `tests/payments/create-tip.test.ts`
- Create: `tests/payments/capture-tip.test.ts`

**Interfaces:**
- `CreatePaymentInput` additionally consumes `providerAccountId`.
- `createTip` returns `{ tipId, status, checkout, receiptToken }`.
- `captureTip` validates tip, provider, receipt token, stored order ID, and connected merchant before provider capture.

- [ ] Write failing tests that a PayPal tip requires a connected account, embeds the correct merchant, returns no redirect URL, and that capture never confirms or writes ledger entries.
- [ ] Run the focused tests and confirm expected failures.
- [ ] Extend creator lookup/repository access to resolve the creator's active payment account only for PayPal mode.
- [ ] Return redirect checkout for mock and embedded checkout data plus receipt token for PayPal.
- [ ] Implement a service that loads the tip by ID and token, checks `provider === "paypal"`, calls capture with the stored merchant/order IDs, and stores only capture ID plus pending/rejected state.
- [ ] Add a rate-limited capture route with generic client errors and safe server logging.
- [ ] Run focused tests and confirm they pass.

### Task 5: Provider-aware verified webhook processing

**Files:**
- Modify: `src/features/payments/process-webhook.ts`
- Modify: `src/features/payments/webhook-handler.ts`
- Modify: `src/features/payments/supabase-webhook-repository.ts`
- Modify: `src/app/api/webhooks/payments/route.ts`
- Create: `supabase/migrations/202608160003_provider_aware_webhooks.sql`
- Modify: `tests/payments/process-webhook.test.ts`
- Create: `tests/payments/paypal-webhook.test.ts`
- Modify: `tests/database/migration-safety.test.ts`

**Interfaces:**
- `processPaymentWebhook(rawBody, headers, dependencies)` awaits verification and parsing.
- `SupabaseWebhookRepository` receives `providerName` and never hardcodes `mock`.
- RPC functions correlate order ID or capture ID and attach the capture ID atomically.

- [ ] Write failing tests for invalid verification, completed capture, duplicate event, pending, declined, full refund, reversal, missing fee, and anonymous push privacy.
- [ ] Run the focused tests and confirm failure from the current hardcoded mock repository and synchronous verifier.
- [ ] Update the webhook processor and route to pass the real `Headers` object while preserving raw body text.
- [ ] Remove every hardcoded `provider: "mock"` from the webhook repository and scope all event updates by the selected provider.
- [ ] Add RPC changes that correlate PayPal order/capture IDs, attach capture ID, preserve unique event idempotency, and reject ambiguous or invalid transitions.
- [ ] Record unsupported and partial-refund events without reversing the full tip.
- [ ] Keep push after a newly processed confirmed transaction only.
- [ ] Run payment, push, money, and migration tests and confirm they pass.

### Task 6: Embedded Card Fields and PayPal Button

**Files:**
- Create: `src/components/payments/paypal-checkout.tsx`
- Create: `src/components/payments/paypal-sdk.ts`
- Modify: `src/components/tips/tip-form.tsx`
- Modify: `src/app/[username]/page.tsx`
- Modify: `src/lib/i18n/es.ts`
- Modify: `src/lib/i18n/en.ts`
- Create: `tests/payments/paypal-checkout.test.tsx`

**Interfaces:**
- `PayPalCheckout` consumes embedded checkout metadata, tip ID, receipt token, locale, and receipt URL.
- `loadPayPalSdk` loads one SDK script per client/merchant/currency tuple and exposes Card Fields and Buttons without an npm dependency.

- [ ] Write failing UI tests for embedded checkout state, card-ineligible fallback, confirmation state, declined state, and no direct confirmed-state mutation.
- [ ] Run the checkout UI tests and confirm expected failures.
- [ ] Change TipForm so mock continues redirecting while PayPal renders the embedded panel without navigation.
- [ ] Load `components=buttons,card-fields`, USD, platform client ID, connected merchant ID, partner attribution ID, and server-generated client token.
- [ ] Render styled Name, Number, Expiry, and CVV Card Fields only when eligible; always render the eligible PayPal Button alternative.
- [ ] On approval, call only the protected capture endpoint, then poll the receipt-authorized status endpoint until webhook-confirmed, rejected, or timeout.
- [ ] Add Spanish/English messages for loading SDK, unavailable card fields, confirming, declined, delayed confirmation, and retry.
- [ ] Run UI tests, typecheck, and lint.

### Task 7: PayPal-mode dashboard, documentation, and full verification

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/payouts/page.tsx`
- Modify: `src/components/dashboard/balance-summary.tsx`
- Modify: `README.md`
- Modify: `docs/manual/pilot-checklist.md`
- Modify: `.env.example`
- Modify: `tests/ui/usd-only-interface.test.tsx`
- Create: `tests/ui/paypal-mode-interface.test.tsx`

**Interfaces:**
- Dashboard copy derives from active provider without changing ledger calculations.
- PayPal mode links to PayPal account management and exposes no TipMe payout mutation.

- [ ] Write failing UI assertions that PayPal mode says `Disponible en PayPal`, offers `Administrar en PayPal`, and hides mock withdrawal actions.
- [ ] Run the UI tests and confirm expected failures.
- [ ] Implement provider-aware dashboard and payout copy while preserving mock mode.
- [ ] Document PayPal Sandbox creation, seller/buyer accounts, REST app, webhook URL/events, environment variables, Multiparty approval, Card Fields eligibility, and the no-live-money guard.
- [ ] Add a manual sequence for connected creator -> anonymous supporter -> embedded sandbox card -> capture -> verified webhook -> push -> PayPal dashboard.
- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run typecheck`.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run build`.
- [ ] Report automated evidence separately from manual steps requiring the user's PayPal credentials and physical devices.
