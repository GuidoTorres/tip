# PayPal Platform Payouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cambiar el modo PayPal activo de Multiparty a cobro centralizado en TipMe y retiro automático a un correo PayPal mediante Payouts, conservando webhook, ledger, Realtime y push.

**Architecture:** `PAYPAL_FLOW` selecciona `platform_payouts` o `multiparty` sin cambiar `PAYMENT_PROVIDER`. En el nuevo flujo, Checkout cobra a TipMe, el webhook acredita solo el neto real y Payouts envía el saldo a la cuenta personal configurada; todas las mutaciones financieras se ejecutan mediante funciones PostgreSQL transaccionales y webhooks verificados.

**Tech Stack:** Next.js 16.3 App Router, TypeScript 5.9, Supabase/PostgreSQL/RLS, PayPal Orders v2 y Payouts v1, Vitest, Web Push.

**Spec:** `docs/superpowers/specs/2026-08-20-paypal-platform-payouts-design.md`

## Global Constraints

- No usar ramas, commits ni otras operaciones Git; el usuario pidió trabajo local y dejar Git fuera.
- Antes de escribir rutas, formularios o Server Actions, leer completos `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `node_modules/next/dist/docs/01-app/02-guides/forms.md`, `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` y `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`.
- No instalar dependencias nuevas.
- Mantener `PAYMENT_PROVIDER=mock` y `PAYPAL_FLOW=multiparty` compilando y con sus pruebas actuales.
- Todo importe se representa como entero en unidades menores y moneda `USD`.
- `PLATFORM_FEE_BPS=0` para el piloto; no hardcodear tarifas.
- El navegador nunca confirma pagos, payouts, estados PayPal ni comisiones reales.
- Un webhook duplicado no duplica ledger, saldo, notificación ni push.
- El correo PayPal se introduce una sola vez, queda `pending` y solo pasa a `verified` tras un payout `SUCCESS`.
- Ningún secreto, correo completo o respuesta sensible de PayPal aparece en logs o respuestas públicas.

---

### Task 1: Configuración de flujo y cálculos monetarios

**Files:**
- Modify: `src/lib/env/server.ts`
- Modify: `src/features/payments/paypal-client.ts`
- Modify: `src/features/ledger/money.ts`
- Modify: `.env.example`
- Test: `tests/domain/runtime.test.ts`
- Test: `tests/domain/money.test.ts`

**Interfaces:**
- Produces: `PayPalFlow = "platform_payouts" | "multiparty"`.
- Produces: `calculateProcessingSupportMinor(baseAmountMinor, feeBps, fixedFeeMinor): number`.
- Produces: `quotePayoutFromDebit(totalDebitMinor, feeBps, feeCapMinor): { totalDebitMinor; recipientAmountMinor; estimatedFeeMinor }`.
- Produces: `ServerEnv` fields `PAYPAL_FLOW`, `PAYPAL_PAYOUT_FEE_BPS`, `PAYPAL_PAYOUT_FEE_CAP_MINOR`, `PAYPAL_CHECKOUT_FEE_BPS`, `PAYPAL_CHECKOUT_FIXED_FEE_MINOR`, `PAYOUT_HOLD_MINUTES`, and optional `PAYPAL_SANDBOX_PAYOUT_RECIPIENT_ID`.

- [ ] **Step 1: Read the required Next.js 16.3 guides**

Run:

```powershell
Get-Content -Raw node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
Get-Content -Raw node_modules/next/dist/docs/01-app/02-guides/forms.md
Get-Content -Raw node_modules/next/dist/docs/01-app/02-guides/server-actions.md
Get-Content -Raw node_modules/next/dist/docs/01-app/02-guides/environment-variables.md
```

Expected: all four documents reach EOF before any application code changes.

- [ ] **Step 2: Write failing configuration and money tests**

Add assertions equivalent to:

```ts
expect(getServerEnv().PAYPAL_FLOW).toBe("platform_payouts");
expect(calculateProcessingSupportMinor(2_000, 540, 30)).toBe(146);
expect(quotePayoutFromDebit(1_839, 200, 100)).toEqual({
  totalDebitMinor: 1_839,
  recipientAmountMinor: 1_802,
  estimatedFeeMinor: 37,
});
```

Also assert invalid basis points, negative fixed fees and non-integer money throw `invalid_money`.

- [ ] **Step 3: Run the focused tests and verify failure**

Run: `npm.cmd test -- tests/domain/runtime.test.ts tests/domain/money.test.ts`

Expected: FAIL because the new environment fields and functions do not exist.

- [ ] **Step 4: Implement minimal validated configuration and integer formulas**

Use Zod defaults matching the approved spec:

```ts
PAYPAL_FLOW: z.enum(["platform_payouts", "multiparty"]).default("platform_payouts"),
PAYPAL_PAYOUT_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(200),
PAYPAL_PAYOUT_FEE_CAP_MINOR: z.coerce.number().int().nonnegative().default(100),
PAYPAL_CHECKOUT_FEE_BPS: z.coerce.number().int().min(0).max(9_999).default(540),
PAYPAL_CHECKOUT_FIXED_FEE_MINOR: z.coerce.number().int().nonnegative().default(30),
PAYOUT_HOLD_MINUTES: z.coerce.number().int().nonnegative().default(0),
PAYPAL_SANDBOX_PAYOUT_RECIPIENT_ID: z.string().trim().optional(),
```

Implement payout quoting by finding the greatest integer recipient amount where `recipient + min(ceil(recipient * bps / 10_000), cap) <= totalDebit`. This ensures `Retirar todo` never needs TipMe funds for the configured normal payout fee.

- [ ] **Step 5: Document fake environment values**

Add to `.env.example`:

```dotenv
PAYPAL_FLOW=platform_payouts
PAYPAL_PAYOUT_FEE_BPS=200
PAYPAL_PAYOUT_FEE_CAP_MINOR=100
PAYPAL_CHECKOUT_FEE_BPS=540
PAYPAL_CHECKOUT_FIXED_FEE_MINOR=30
PAYOUT_HOLD_MINUTES=0
PAYPAL_SANDBOX_PAYOUT_RECIPIENT_ID=fake-sandbox-paypal-account-id
```

- [ ] **Step 6: Re-run focused verification**

Run: `npm.cmd test -- tests/domain/runtime.test.ts tests/domain/money.test.ts`

Expected: PASS.

---

### Task 2: Migración financiera y RLS del correo PayPal

**Files:**
- Create: `supabase/migrations/202608200001_paypal_platform_payouts.sql`
- Modify: `supabase/seed.sql`
- Modify: `docs/manual/database-verification.md`
- Modify: `tests/database/migration-safety.test.ts`

**Interfaces:**
- Produces RPC authenticated: `set_my_paypal_payout_email(p_email text) returns uuid`.
- Produces RPC service-role: `request_platform_payout(p_creator_id uuid, p_account_id uuid, p_total_debit_minor bigint, p_recipient_amount_minor bigint, p_estimated_fee_minor bigint, p_currency currency_code, p_idempotency_key text) returns uuid`.
- Produces RPC service-role: `attach_platform_payout(p_payout_id uuid, p_batch_id text, p_provider_status text) returns void`.
- Produces RPC service-role: `fail_platform_payout_submission(p_payout_id uuid, p_failure_code text) returns boolean`.
- Produces RPC service-role: `transition_platform_payout_from_provider(...)` returning `newly_processed`, `creator_id`, `payout_id`, `notification_id`, `account_id`.

- [ ] **Step 1: Write a failing RLS regression test**

Add static migration-contract assertions proving the SQL revokes authenticated writes, drops creator update policies and grants only the controlled email RPC. The manual database check must prove an authenticated creator cannot directly execute:

```ts
supabase.from("payout_accounts").update({ status: "verified" }).eq("creator_id", creatorId);
```

Expected after migration: the direct update is denied, while `set_my_paypal_payout_email` can only write the caller's own account with `provider = paypal` and `status = pending`.

- [ ] **Step 2: Run the security test and verify it exposes current behavior**

Run: `npm.cmd test -- tests/database/migration-safety.test.ts`

Expected: FAIL because the new migration and permission statements do not exist.

- [ ] **Step 3: Add additive tip and payout columns**

The migration adds:

```sql
alter table public.tips
  add column base_amount_minor bigint,
  add column processing_support_minor bigint not null default 0;

update public.tips set base_amount_minor = amount_minor where base_amount_minor is null;
alter table public.tips alter column base_amount_minor set not null;

alter table public.payouts
  add column recipient_amount_minor bigint,
  add column estimated_fee_minor bigint not null default 0,
  add column gateway_fee_minor bigint,
  add column provider_batch_id text,
  add column provider_payout_item_id text,
  add column provider_status text;
```

Backfill existing payouts with `recipient_amount_minor = amount_minor`, then make it non-null. Add checks for nonnegative fees, `recipient_amount_minor + estimated_fee_minor <= amount_minor`, and unique partial indexes for PayPal batch/item IDs.

Add a partial unique index that permits only one `requested` or `processing` payout per creator. This prevents two simultaneous first withdrawals from a still-`pending` destination and simplifies provider reconciliation.

- [ ] **Step 4: Lock payout account verification behind trusted functions**

Drop creator write policies and table write grants on `payout_accounts`. Implement `set_my_paypal_payout_email` as `security definer`, validate `auth.uid()`, normalize with `lower(trim(p_email))`, reject invalid/overlong email, upsert one PayPal account per creator, set `country = 'XX'`, `bank_name = 'PayPal'`, and always reset changed destinations to `pending`.

Grant only `execute` on this function to `authenticated`; retain table writes for `service_role`.

- [ ] **Step 5: Add atomic platform payout functions**

`request_platform_payout` must:

```sql
perform pg_advisory_xact_lock(hashtextextended(p_creator_id::text || ':' || p_currency::text, 0));
```

Then verify account ownership/provider/status (`pending` or `verified`), reconstruct balance from ledger, validate all three amounts, insert one payout by idempotency key and write one negative `reserve_hold` for `p_total_debit_minor`.

`transition_platform_payout_from_provider` must deduplicate `webhook_events`. On success it writes `reserve_release +total`, `payout -recipient`, and `gateway_fee -actual_fee`, completes the payout, marks the destination `verified`, and creates one internal notification. On a final failure it releases the total reserve once. Processing and unclaimed states keep the reserve.

- [ ] **Step 6: Update seed and manual verification SQL**

Seed new columns explicitly and add verification queries proving:

```sql
select amount_minor,
       recipient_amount_minor + estimated_fee_minor <= amount_minor as quote_valid
from public.payouts;
```

Also include an RLS check that client roles cannot set `status = 'verified'`.

- [ ] **Step 7: Apply the migration manually in Supabase and run the RLS test**

User action: paste `202608200001_paypal_platform_payouts.sql` into Supabase SQL Editor once, then report any SQL error verbatim.

Run: `npm.cmd test -- tests/database/migration-safety.test.ts`

Expected: PASS. Then manually verify the RLS behavior against the Supabase project as documented.

---

### Task 3: Checkout centralizado y aporte voluntario de procesamiento

**Files:**
- Modify: `src/features/payments/provider.ts`
- Modify: `src/features/payments/provider-factory.ts`
- Modify: `src/features/payments/paypal-client.ts`
- Modify: `src/features/payments/paypal-provider.ts`
- Modify: `src/features/payments/create-tip.ts`
- Modify: `src/features/payments/supabase-tip-repository.ts`
- Create: `src/features/payouts/destination-repository.ts`
- Modify: `src/features/payments/capture-tip.ts`
- Modify: `src/app/api/tips/route.ts`
- Modify: `src/app/api/paypal/tips/[tipId]/capture/route.ts`
- Modify: `src/components/tips/tip-form.tsx`
- Test: `tests/payments/create-tip.test.ts`
- Test: `tests/payments/paypal-provider.test.ts`
- Test: `tests/payments/capture-tip.test.ts`
- Test: `tests/ui/paypal-checkout.test.tsx`

**Interfaces:**
- `CreateTipInput` adds `coverProcessing: boolean`.
- `NewTip` adds `baseAmountMinor` and `processingSupportMinor`.
- `PayPalConfig` adds `flow: PayPalFlow`.
- `SupabasePayoutDestinationRepository.findConfigured(creatorId): Promise<{ id: string; status: "pending" | "verified" } | null>`.

- [ ] **Step 1: Write failing centralized order tests**

Assert `platform_payouts` creates an order whose purchase unit has no `payee`, no `payment_instruction`, no `PayPal-Auth-Assertion`, and whose amount equals server-calculated base plus support. Assert `multiparty` retains current payee/platform-fee fields.

Add a creation test:

```ts
const result = await createTip({
  username: "camila",
  amountMinor: 2_000,
  anonymous: true,
  legalAccepted: true,
  legalTermsVersion: CURRENT_LEGAL_TERMS_VERSION,
  coverProcessing: true,
}, deps);
expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({
  baseAmountMinor: 2_000,
  processingSupportMinor: 146,
  amountMinor: 2_146,
}));
```

- [ ] **Step 2: Run focused payment tests and verify failure**

Run: `npm.cmd test -- tests/payments/create-tip.test.ts tests/payments/paypal-provider.test.ts tests/payments/capture-tip.test.ts tests/ui/paypal-checkout.test.tsx`

Expected: FAIL on missing flow and contribution behavior.

- [ ] **Step 3: Split PayPal order construction by flow**

Keep one provider class but make order creation explicit:

```ts
if (config.flow === "platform_payouts") return client.createPlatformOrder(input);
return client.createMultipartyOrder(input);
```

The platform order uses TipMe's own credentials. Capture also omits merchant assertion in this flow. The embedded checkout still receives TipMe's public client ID and merchant ID required by the existing PayPal SDK component.

- [ ] **Step 4: Require a configured payout destination, not a Multiparty merchant**

In `platform_payouts`, public tip creation checks for one creator `payout_accounts` row with provider PayPal and status `pending` or `verified`. It never sends that email to Orders API. In `multiparty`, retain `payment_accounts.findConnected` and the connected merchant ID.

Update capture lookup so platform captures do not depend on `payment_accounts`; use the TipMe merchant configured server-side.

- [ ] **Step 5: Calculate the optional contribution server-side**

The API accepts only the boolean. `createTip` computes:

```ts
const supportMinor = value.coverProcessing
  ? calculateProcessingSupportMinor(value.amountMinor, checkoutFeeBps, checkoutFixedFeeMinor)
  : 0;
const chargedMinor = value.amountMinor + supportMinor;
```

Persist base, support and charged total. Render the checkbox and show an estimated total without language promising an exact creator net.

- [ ] **Step 6: Make real capture fee mandatory in platform flow**

Add `PayPalClient.getCapture(captureId)` and, for `PAYMENT.CAPTURE.COMPLETED`, fetch details when the webhook payload lacks `seller_receivable_breakdown.paypal_fee`. If it remains unavailable in `platform_payouts`, throw `paypal_fee_unavailable` so PayPal retries; do not confirm, write ledger or push.

- [ ] **Step 7: Re-run focused tests**

Run: `npm.cmd test -- tests/payments/create-tip.test.ts tests/payments/paypal-provider.test.ts tests/payments/capture-tip.test.ts tests/ui/paypal-checkout.test.tsx`

Expected: PASS for mock, Multiparty and platform payouts cases.

---

### Task 4: Adaptador PayPal Payouts e idempotencia de envío

**Files:**
- Modify: `src/features/payments/provider.ts`
- Modify: `src/features/payments/paypal-client.ts`
- Modify: `src/features/payments/paypal-provider.ts`
- Modify: `src/features/payouts/service.ts`
- Modify: `src/features/payouts/supabase-repository.ts`
- Modify: `src/features/payouts/actions.ts`
- Test: `tests/payments/paypal-provider.test.ts`
- Test: `tests/payouts/payouts.test.ts`

**Interfaces:**
- `CreatePayoutInput` adds `recipientAmountMinor`, `estimatedFeeMinor`, and `recipientType: "EMAIL" | "PAYPAL_ID"`.
- `PayoutResult = { providerBatchId: string; status: "processing" }`.
- `PayPalClient.createPayoutBatch(input)` calls `POST /v1/payments/payouts`.
- `PayPalClient.getPayoutItem(itemId)` calls `GET /v1/payments/payouts-item/{itemId}`.
- `PayPalClient.cancelUnclaimedPayoutItem(itemId)` calls `POST /v1/payments/payouts-item/{itemId}/cancel`.

- [ ] **Step 1: Write failing Payouts API contract tests**

Assert the outbound request contains:

```ts
{
  sender_batch_header: { sender_batch_id: `tipme:${payoutId}` },
  items: [{
    sender_item_id: payoutId,
    recipient_type: "EMAIL",
    recipient_wallet: "PAYPAL",
    receiver: "creator@example.com",
    amount: { currency: "USD", value: "18.02" },
  }],
}
```

In Sandbox with the configured override, assert only `recipient_type` and `receiver` change to `PAYPAL_ID` and the Account ID.

- [ ] **Step 2: Write payout service failure tests**

Cover:

```ts
await expect(requestPayout(input, deps)).resolves.toEqual(expect.objectContaining({ status: "processing" }));
expect(repository.reservePayout).toHaveBeenCalledTimes(1);
expect(provider.createPayout).toHaveBeenCalledTimes(1);
```

Also verify a definitive PayPal 4xx calls `failSubmission`, while timeout/5xx keeps the reserve for reconciliation and never retries with a new batch ID.

- [ ] **Step 3: Run focused payout tests and verify failure**

Run: `npm.cmd test -- tests/payments/paypal-provider.test.ts tests/payouts/payouts.test.ts`

Expected: FAIL because PayPal currently throws `payouts_managed_by_paypal`.

- [ ] **Step 4: Implement Payouts client methods**

Use the existing cached client-credentials token and PayPal request helper. `sender_batch_id` and `sender_item_id` derive only from TipMe's immutable payout UUID. Do not include Multiparty headers in `platform_payouts`.

Extend `PayPalApiError` to retain safe `status` and a retryability classification without logging response bodies containing recipient data.

- [ ] **Step 5: Implement transactional request orchestration**

The Server Action authenticates with Supabase, calculates a quote from the submitted total ledger debit, reserves through the service-role RPC, then calls PayPal. A definitive pre-send rejection releases through `fail_platform_payout_submission`; an ambiguous error keeps the payout processing and shows `Estamos comprobando tu retiro`.

Use the same payout UUID for every retry. Do not generate a new idempotency key after reserve.

- [ ] **Step 6: Re-run focused payout tests**

Run: `npm.cmd test -- tests/payments/paypal-provider.test.ts tests/payouts/payouts.test.ts`

Expected: PASS, including the existing mock provider tests.

---

### Task 5: Webhooks de Payouts, ledger definitivo y push

**Files:**
- Modify: `src/features/payments/provider.ts`
- Modify: `src/features/payments/paypal-provider.ts`
- Modify: `src/features/payments/webhook-handler.ts`
- Modify: `src/features/payments/process-webhook.ts`
- Modify: `src/features/payouts/service.ts`
- Modify: `src/features/payouts/supabase-repository.ts`
- Modify: `src/app/api/webhooks/payments/route.ts`
- Test: `tests/payments/paypal-webhook.test.ts`
- Test: `tests/payments/process-webhook.test.ts`
- Test: `tests/payouts/payouts.test.ts`
- Create: `tests/notifications/payout-push.test.ts`

**Interfaces:**
- Produces discriminated union `ProviderWebhookEvent = PaymentWebhookEvent | PayoutWebhookEvent` with `kind: "payment" | "payout"`.
- `PayoutWebhookEvent` includes `eventId`, `payoutId` from PayPal `sender_item_id`, `providerPayoutItemId`, `status: "processing" | "completed" | "failed" | "unclaimed"`, `actualFeeMinor`, `failureCode`, and `occurredAt`.

- [ ] **Step 1: Write failing webhook mapping tests**

Map exact PayPal item events:

```ts
const expected = {
  "PAYMENT.PAYOUTS-ITEM.SUCCEEDED": "completed",
  "PAYMENT.PAYOUTS-ITEM.FAILED": "failed",
  "PAYMENT.PAYOUTS-ITEM.BLOCKED": "failed",
  "PAYMENT.PAYOUTS-ITEM.RETURNED": "failed",
  "PAYMENT.PAYOUTS-ITEM.CANCELED": "failed",
  "PAYMENT.PAYOUTS-ITEM.REFUNDED": "failed",
  "PAYMENT.PAYOUTS-ITEM.HELD": "processing",
  "PAYMENT.PAYOUTS-ITEM.UNCLAIMED": "unclaimed",
};
```

The provider must call payout-item details and correlate using `payout_item.sender_item_id`; batch events alone do not move ledger.

- [ ] **Step 2: Add duplicate and notification tests**

Assert three deliveries of one succeeded event cause one database transition, one internal notification and one logical push. Assert `UNCLAIMED` requests cancellation once, keeps reserve, and only `CANCELED`/`RETURNED` releases it.

- [ ] **Step 3: Run focused webhook tests and verify failure**

Run: `npm.cmd test -- tests/payments/paypal-webhook.test.ts tests/payments/process-webhook.test.ts tests/payouts/payouts.test.ts tests/notifications/payout-push.test.ts`

Expected: FAIL on the new payout event kind.

- [ ] **Step 4: Route verified events by kind**

Keep one `/api/webhooks/payments` endpoint and one PayPal signature verification. After parsing, dispatch payment events to the existing confirmation service and payout events to `processPayoutEvent`. Unknown and batch-only events are recorded as ignored/observational without ledger mutations.

- [ ] **Step 5: Reconcile success and terminal failures**

On success pass the actual PayPal fee into `transition_platform_payout_from_provider`. The RPC releases the full estimate, debits recipient amount plus actual fee, marks the email verified, and creates the notification. On terminal failure release once. On held/processing leave the reserve untouched.

- [ ] **Step 6: Preserve push privacy and deep link**

Completed copy:

```text
Retiro completado
$18.02 fueron enviados a tu cuenta PayPal.
```

Failed copy contains no email or account identifier. The notification opens `/dashboard/payouts` or the existing dashboard fallback.

- [ ] **Step 7: Re-run focused webhook and push tests**

Run: `npm.cmd test -- tests/payments/paypal-webhook.test.ts tests/payments/process-webhook.test.ts tests/payouts/payouts.test.ts tests/notifications/payout-push.test.ts`

Expected: PASS.

---

### Task 6: Onboarding, dashboard y pantalla de retiros

**Files:**
- Create: `src/features/payouts/account-actions.ts`
- Create: `src/components/payouts/paypal-email-form.tsx`
- Modify: `src/app/onboarding/page.tsx`
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/payouts/page.tsx`
- Modify: `src/components/payouts/payout-form.tsx`
- Modify: `src/components/dashboard/paypal-connection-badge.tsx`
- Modify: `src/components/payouts/paypal-funds-panel.tsx`
- Test: `tests/ui/paypal-connect.test.tsx`
- Test: `tests/ui/dashboard-paypal-status.test.tsx`
- Test: `tests/ui/paypal-payouts-page.test.tsx`

**Interfaces:**
- Server Action `savePayPalPayoutEmail(formData: FormData): Promise<never>` redirects to onboarding/settings with safe status.
- `PayoutForm` receives `feeBps`, `feeCapMinor`, and computes the same quote for display; the server recalculates it independently.

- [ ] **Step 1: Write failing UI tests**

Assert the onboarding renders exactly one required `type="email"` input, no Partner popup, and copy explaining `PayPal confirmará la cuenta con el primer retiro`.

Assert the dashboard badge renders `PayPal configurado` for `pending` and `PayPal confirmado` for `verified`. Assert the payout page is visible when `PAYPAL_FLOW=platform_payouts` and hidden only for `multiparty`.

- [ ] **Step 2: Run focused UI tests and verify failure**

Run: `npm.cmd test -- tests/ui/paypal-connect.test.tsx tests/ui/dashboard-paypal-status.test.tsx tests/ui/paypal-payouts-page.test.tsx`

Expected: FAIL because current PayPal UI claims direct delivery and hides payouts.

- [ ] **Step 3: Replace active Partner onboarding UI with email setup**

The form posts one `paypalEmail` field. The Server Action authenticates, validates with Zod, calls `set_my_paypal_payout_email`, and redirects to step 3. Do not delete Partner Referral routes or components; they remain reachable only when `PAYPAL_FLOW=multiparty`.

- [ ] **Step 4: Restore the payout navigation and page**

Render withdrawal navigation for mock and `platform_payouts`. The PayPal page reads `payout_accounts`, balances, payout history and ledger payout totals. Remove copy saying funds arrive directly or must be opened in PayPal.

- [ ] **Step 5: Display transparent payout quote**

Para un saldo utilizado de `$18.39`, render:

```text
Usar de tu saldo       $18.39
Envío PayPal estimado  -$0.37
Recibirás aprox.       $18.02
```

Use `aprox.` before submission and the real fee in completed history. Provide `Retirar todo`, which fills the entire current available balance without a fixed maximum.

- [ ] **Step 6: Render safe payout states**

Support `requested`, `processing`, `completed`, and `failed`; show configured/confirmed email masked. A pending email may make its validating first payout. A rejected account sees a correction action. No screen exposes a full email after save.

- [ ] **Step 7: Re-run UI tests**

Run: `npm.cmd test -- tests/ui/paypal-connect.test.tsx tests/ui/dashboard-paypal-status.test.tsx tests/ui/paypal-payouts-page.test.tsx`

Expected: PASS on mobile-first markup and both PayPal flows.

---

### Task 7: Legal, documentación y verificación completa

**Files:**
- Modify: `src/features/legal/content.ts`
- Modify: `README.md`
- Modify: `docs/manual/pilot-checklist.md`
- Modify: `docs/manual/database-verification.md`
- Modify: `.env.example`
- Test: `tests/ui/legal-pages.test.tsx`

**Interfaces:**
- No new runtime interface; this task aligns user-facing disclosures and operator steps with the implemented money flow.

- [ ] **Step 1: Write a failing legal-copy test**

Assert Spanish and English content explains that TipMe temporarily receives the payment, distributes through PayPal Payouts, deducts actual processing/payout fees, and may apply refunds or chargebacks to the responsible creator ledger. It must not claim direct creator settlement in `platform_payouts`.

- [ ] **Step 2: Run the legal test and verify failure**

Run: `npm.cmd test -- tests/ui/legal-pages.test.tsx`

Expected: FAIL because current copy predates centralized Payouts.

- [ ] **Step 3: Update legal pages and README**

Document the exact pilot flow, email validation limitation, pooled PayPal liquidity risk, no TipMe fee, creator-paid provider fees, refund behavior, Sandbox override, webhook events and Live capability checks. Do not claim legal immunity or guaranteed instant settlement.

- [ ] **Step 4: Update the manual pilot checklist**

Include:

1. Apply migration.
2. Configure fake/local and Vercel environment values.
3. Add PayPal capture and Payouts item webhook events.
4. Register creator with one PayPal email.
5. Complete a `$20` Sandbox tip.
6. Confirm exact capture fee, ledger and push.
7. Withdraw all available minus estimated payout fee using Sandbox Account ID override.
8. Confirm payout fee, recipient funds and payout push.
9. Replay both webhooks and verify no duplicate money or push.
10. Test `UNCLAIMED`, cancellation and reserve release.

- [ ] **Step 5: Run all automated verification**

Run sequentially:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Expected: all commands exit `0`. Do not describe the feature as working if any command fails.

- [ ] **Step 6: Perform user-owned external checks**

The user performs the PayPal Developer/Vercel/Supabase steps that require their accounts and real devices. Record exact webhook event timestamps and verify iPhone push after closing the installed PWA. Production activation occurs only after Live Payouts access is confirmed with a small controlled transaction.
