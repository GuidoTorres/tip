# Whop Platform Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporar Whop como proveedor de pagos directo para TipMe: cada creador usa una connected account, el fan paga dentro de TipMe, Whop descuenta sus costos, TipMe recibe 1% y el creador administra su retiro en Whop; el webhook firmado conserva ledger, saldo, Realtime y push.

**Architecture:** `PAYMENT_PROVIDER=whop` selecciona un adapter nuevo sin eliminar `mock` ni `paypal`. El backend crea la connected company y enlaces hospedados de onboarding/payouts. Cada tip crea un checkout dinámico sobre la company del creador con `application_fee_amount`; el navegador solo presenta el checkout y consulta el comprobante. `POST /api/webhooks/whop` verifica la firma sobre el cuerpo crudo y es la única entrada capaz de confirmar, rechazar o revertir dinero.

**Tech Stack:** Next.js 16.3 App Router, TypeScript 5.9, `@whop/sdk`, `@whop/checkout`, Supabase/PostgreSQL/RLS, Vitest, Web Push.

**Spec:** `docs/superpowers/specs/2026-08-20-whop-platform-payments-design.md`

## Global Constraints

- No usar ramas, commits ni ninguna operación Git; el usuario pidió trabajo local.
- Mantener `PAYMENT_PROVIDER=mock` y `PAYMENT_PROVIDER=paypal` compilando y sin cambiar su comportamiento.
- Mantener todos los importes internos como enteros en unidades menores. Convertir a decimal solo en el borde del SDK de Whop.
- Usar `PLATFORM_FEE_BPS=100`; no hardcodear 1% dentro del proveedor.
- El navegador, `onComplete` y la URL de retorno nunca confirman pagos ni alteran el ledger.
- No asumir acceso live a Whop for Platforms: la integración debe funcionar en sandbox y mostrar una indisponibilidad clara si Whop responde `403` o no habilita connected accounts.
- No registrar API keys, secretos de webhook, datos de tarjeta, emails completos de compradores ni payloads financieros completos.
- Toda ruta autenticada revalida sesión y propiedad del recurso; no confiar en datos de una página o callback.
- Un evento duplicado o fuera de orden no duplica ledger, saldo, notificación ni push.
- Las fees reales solo se guardan desde un Payment autoritativo de Whop. Si faltan datos, el evento queda registrado para revisión y no se inventa una fee.
- Los términos deben describir apoyo a contenido/servicios digitales públicos legítimos; no presentarlo como donación personal, remesa, préstamo o transferencia P2P.

---

### Task 1: Dependencias y configuración aislada de Whop

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/lib/env/server.ts`
- Modify: `src/features/payments/provider-factory.ts`
- Create: `src/features/payments/whop-client.ts`
- Modify: `.env.example`
- Test: `tests/domain/runtime.test.ts`
- Test: `tests/payments/provider-factory.test.ts`

**Interfaces:**
- Produces: `WhopEnvironment = "sandbox" | "production"`.
- Produces: `WhopConfig = { apiKey; webhookSecret; platformCompanyId; environment; apiBaseUrl }`.
- Produces: `createWhopClient(config)` in a `server-only` module.

- [ ] **Step 1: Write failing environment and factory tests**

Assert that Whop is accepted, the fee defaults to 100 for a Whop fixture, sandbox resolves to `https://sandbox-api.whop.com/api/v1`, production uses the SDK default, and missing real Whop values produce controlled configuration errors when `PAYMENT_PROVIDER=whop`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm.cmd test -- tests/domain/runtime.test.ts tests/payments/provider-factory.test.ts
```

Expected: FAIL because `whop` and its configuration do not exist.

- [ ] **Step 3: Install only the two official dependencies**

Run:

```powershell
npm.cmd install @whop/sdk @whop/checkout
```

Inspect the installed TypeScript declarations before using resource fields. Do not add payout-component packages because the MVP will use Whop's hosted payout portal.

- [ ] **Step 4: Add validated server-only configuration**

Extend the environment schema with:

```ts
PAYMENT_PROVIDER: z.enum(["mock", "paypal", "whop", "nuvei", "ebanx", "dlocal"]).default("mock"),
WHOP_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
WHOP_API_KEY: z.string().min(1).default("fake-whop-api-key-replace-me"),
WHOP_WEBHOOK_SECRET: z.string().min(1).default("fake-whop-webhook-secret-replace-me"),
WHOP_PLATFORM_COMPANY_ID: z.string().min(1).default("biz_fake_replace_me"),
WHOP_CHECKOUT_FEE_BPS: z.coerce.number().int().min(0).max(9_999).default(270),
WHOP_CHECKOUT_FIXED_FEE_MINOR: z.coerce.number().int().nonnegative().default(30),
```

Keep `PLATFORM_FEE_BPS` generic and set `100` in `.env.example`, not as a provider constant.

- [ ] **Step 5: Create the Whop client boundary**

Use `import "server-only"`. Instantiate the official SDK with `apiKey` and `webhookKey` only on the server. Pass sandbox `baseURL` exactly once in this boundary so application code does not branch on URLs.

- [ ] **Step 6: Register a temporary provider factory branch**

Add the Whop config to `ProviderConfig` and return `WhopPaymentProvider`; until Task 4 creates that class, use a compile-time import target and complete both tasks before running the suite.

- [ ] **Step 7: Document fake values**

Add:

```dotenv
PAYMENT_PROVIDER=whop
PLATFORM_FEE_BPS=100
WHOP_ENVIRONMENT=sandbox
WHOP_API_KEY=fake-whop-api-key-replace-me
WHOP_WEBHOOK_SECRET=fake-whop-webhook-secret-replace-me
WHOP_PLATFORM_COMPANY_ID=biz_fake_replace_me
WHOP_CHECKOUT_FEE_BPS=270
WHOP_CHECKOUT_FIXED_FEE_MINOR=30
```

- [ ] **Step 8: Re-run focused tests after Task 4 provides the adapter**

Expected: PASS without exposing the private key in any client bundle or returned object.

---

### Task 2: Migración de connected accounts y ajustes financieros idempotentes

**Files:**
- Create: `supabase/migrations/202608200005_whop_platform_accounts.sql`
- Modify: `src/features/payments/payment-account-repository.ts`
- Test: `tests/database/migration-safety.test.ts`
- Test: `tests/payments/payment-account-repository.test.ts`

**Interfaces:**
- Produces: `payment_accounts.provider in ('paypal','whop')`.
- Produces: `provider_financial_adjustments` keyed by `(provider, provider_adjustment_id)`.
- Produces RPCs `apply_tip_refund_from_webhook(...)` and `apply_tip_dispute_from_webhook(...)`.
- Produces: generic `upsertProviderAccount(...)` and `findByCreator(...)` repository methods.

- [ ] **Step 1: Write migration-contract tests first**

Test behavior, not source wording: apply the migration to the disposable Supabase test database when available. At minimum, keep the existing migration safety harness and assert the new SQL can be loaded, owns explicit RLS/revokes, and defines the required unique constraints and RPC signatures.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npm.cmd test -- tests/database/migration-safety.test.ts tests/payments/payment-account-repository.test.ts
```

- [ ] **Step 3: Expand `payment_accounts` safely**

Drop only the named `payment_accounts_provider_valid` check and recreate it with `paypal` and `whop`. Do not recreate or delete the table. Keep its existing RLS and uniqueness `(creator_id, provider)` / `(provider, provider_merchant_id)`.

- [ ] **Step 4: Add adjustment records for partial and repeated events**

Create a private service-role table shaped as:

```sql
provider_financial_adjustments (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_adjustment_id text not null,
  provider_payment_id text not null,
  tip_id uuid not null references public.tips(id) on delete restrict,
  kind text not null check (kind in ('refund','dispute_hold','dispute_release','chargeback')),
  amount_minor bigint not null check (amount_minor > 0),
  currency public.currency_code not null,
  provider_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_adjustment_id, kind)
)
```

Enable RLS, revoke `anon` and `authenticated`, and grant only `service_role`. This table is audit state; the creator sees the resulting ledger, not raw provider payloads.

- [ ] **Step 5: Implement transactional adjustment RPCs**

Each RPC must:

1. insert the `webhook_events` row with `ON CONFLICT DO NOTHING`;
2. lock the tip found by `provider_capture_id` first, with `provider_payment_id` fallback;
3. reject currency mismatch, negative/zero amount and cumulative adjustment above the creator's credited net;
4. insert exactly one adjustment row per stable Whop resource/state;
5. insert a ledger entry for the exact creator exposure, not the gross buyer refund;
6. update the tip to `refunded` only when the confirmed value has been fully refunded, and to `chargeback` only when a dispute is lost;
7. mark the webhook processed or failed with a controlled `error_code`.

Because the current unique index permits one ledger row per `(tip_id,type)`, adjustment ledger rows must use `tip_id = null` and controlled metadata containing only `tip_id`, `provider_adjustment_id` and `provider_status`. The private adjustment table supplies the foreign key and uniqueness.

- [ ] **Step 6: Generalize the repository without breaking PayPal**

Replace `upsertPayPal` internals with a generic writer:

```ts
upsertProviderAccount({
  creatorId,
  provider: "paypal" | "whop",
  providerMerchantId,
  status,
  onboardingCompleted,
  emailConfirmed,
  paymentsReceivable,
  cardPaymentsEnabled,
}): Promise<void>
```

Keep `upsertPayPal` as a thin compatibility method until PayPal tests are migrated.

- [ ] **Step 7: Re-run focused tests**

Expected: migration is additive, provider account ownership is enforced, duplicates cannot create a second adjustment.

---

### Task 3: Connected-company onboarding para creadores

**Files:**
- Create: `src/features/payments/whop-onboarding.ts`
- Create: `src/app/api/whop/onboarding/route.ts`
- Create: `src/app/api/whop/onboarding/callback/route.ts`
- Create: `src/app/api/whop/onboarding/status/route.ts`
- Create: `src/components/payments/whop-connect.tsx`
- Modify: `src/app/onboarding/page.tsx`
- Test: `tests/payments/whop-onboarding.test.ts`
- Test: `tests/payments/whop-onboarding-route.test.ts`
- Test: `tests/ui/onboarding-flow.test.tsx`

**Interfaces:**
- Consumes: creator id, auth email, public name, platform company id.
- Calls: `companies.create({ email, parent_company_id, title, metadata })` once per creator.
- Calls: `accountLinks.create({ company_id, use_case: "account_onboarding", return_url, refresh_url })`.
- Produces: `{ actionUrl }` and safe status `{ status: "pending" | "connected" | "restricted" }`.

- [ ] **Step 1: Write failing domain tests**

Cover: una llamada repetida reuses the stored `biz_...`; metadata only contains the internal creator id; another authenticated user cannot request that company's link; callback alone remains `pending`; sandbox can report `connected` only after a successful server-side capability probe.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd test -- tests/payments/whop-onboarding.test.ts tests/payments/whop-onboarding-route.test.ts tests/ui/onboarding-flow.test.tsx
```

- [ ] **Step 3: Implement the onboarding service**

Use an injected narrow client interface so tests mock Whop, not TipMe logic. Creation flow:

```ts
const company = await client.companies.create({
  email,
  parent_company_id: platformCompanyId,
  title: publicName,
  metadata: { tipme_creator_id: creatorId },
});
```

Persist the company as `provider='whop'`, `status='pending'` before returning an account link. If persistence succeeds and link creation fails, the next request reuses the company rather than creating another.

- [ ] **Step 4: Implement secure routes**

All three routes call `supabase.auth.getUser()`. Generate return and refresh URLs from `NEXT_PUBLIC_APP_URL`; do not accept them from the client. Callback only redirects to onboarding and never sets connected state from query parameters.

- [ ] **Step 5: Determine readiness from provider evidence**

Use documented Whop resource fields/types exposed by the installed SDK. Live requires KYC/payout readiness returned by Whop or the corresponding signed webhook. In sandbox, where payouts/KYC are unavailable, mark checkout-ready only after the connected company can be retrieved under the parent key; label the UI `Sandbox`.

- [ ] **Step 6: Add the onboarding UI**

In step 2, render Whop when `PAYMENT_PROVIDER=whop`: one large `Conectar con Whop` action, concise explanation that Whop verifies identity and handles withdrawals, returning state, and a retry. Do not request bank details in TipMe.

- [ ] **Step 7: Re-run focused tests**

Expected: no duplicate child company, no callback trust, and onboarding can continue only with server-verified readiness.

---

### Task 4: Adapter Whop y checkout dinámico de direct charge

**Files:**
- Modify: `src/features/payments/provider.ts`
- Create: `src/features/payments/whop-provider.ts`
- Modify: `src/features/payments/provider-factory.ts`
- Modify: `src/features/payments/create-tip.ts`
- Modify: `src/features/payments/prepare-checkout.ts`
- Modify: `src/app/api/payments/checkout-config/route.ts`
- Modify: `src/app/api/tips/route.ts`
- Test: `tests/payments/whop-provider.test.ts`
- Test: `tests/payments/create-tip.test.ts`
- Test: `tests/payments/prepare-checkout.test.ts`

**Interfaces:**
- Extends checkout with `{ kind: "whop_embedded"; sessionId; planId; environment }`.
- Stores checkout configuration id `ch_...` in `tips.provider_payment_id`.
- Sends `tipme_tip_id` in Whop checkout metadata.

- [ ] **Step 1: Write failing adapter tests with complete Whop fixtures**

For `$20.00` and 1%, assert the SDK call is exactly equivalent to:

```ts
checkoutConfigurations.create({
  company_id: "biz_creator",
  currency: "usd",
  plan: {
    initial_price: 20,
    plan_type: "one_time",
    application_fee_amount: 0.2,
  },
  metadata: { tipme_tip_id: "tip-uuid" },
})
```

Assert the result contains both `ch_...` and `plan_...`, rejects non-USD, missing company, zero/negative price, a fee greater than/equal to total, and an SDK response missing either id.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd test -- tests/payments/whop-provider.test.ts tests/payments/create-tip.test.ts tests/payments/prepare-checkout.test.ts
```

- [ ] **Step 3: Extend the provider presentation union**

Add:

```ts
type WhopEmbeddedCheckout = {
  kind: "whop_embedded";
  sessionId: string;
  planId: string;
  environment: "sandbox" | "production";
};
```

Do not pretend Whop supports TipMe-managed payouts: `createPayout` and `getPayoutStatus` throw controlled `payouts_managed_by_whop` errors and are not used by the Whop UI.

- [ ] **Step 4: Implement integer-safe decimal conversion**

For USD use `minor / 100` only at the Whop SDK call. Validate integers before conversion. The application fee is the already-calculated `platformFeeMinor`; omit `application_fee_amount` only when the value is zero because Whop requires a positive fee smaller than total.

- [ ] **Step 5: Require connected Whop account in `createTip`**

Generalize the PayPal-only branch: when the active provider requires a connected account (`paypal` multiparty or `whop`), call `findConnected(creator.id, provider.name)` and use its `providerMerchantId`. Return `whop_account_not_connected` as a safe 404/409-style application error.

- [ ] **Step 6: Make checkout bootstrap provider-neutral**

Whop does not create a checkout during `GET /checkout-config`; return `{ kind: "deferred_embedded", provider: "whop" }` after verifying the creator has a connected account. The actual unique checkout is created only after the fan submits valid tip data through `POST /api/tips`.

- [ ] **Step 7: Pass provider-specific fee estimate**

In `/api/tips`, select Whop or PayPal checkout estimates from the active provider. These estimates only power the optional fan contribution and must remain labeled estimated until the webhook supplies actual fees.

- [ ] **Step 8: Re-run focused tests**

Expected: exact 1% application fee, no provider ids supplied by the browser, existing mock/PayPal cases still pass.

---

### Task 5: Checkout Whop embebido en una sola pantalla

**Files:**
- Create: `src/components/payments/whop-checkout.tsx`
- Modify: `src/components/tips/tip-form.tsx`
- Create: `src/app/tips/[tipId]/return/page.tsx`
- Test: `tests/payments/whop-checkout.test.tsx`
- Test: `tests/ui/fan-single-screen-checkout.test.tsx`

**Interfaces:**
- Consumes only `sessionId`, `planId`, `receiptUrl`, `environment` and locale.
- Uses `WhopCheckoutEmbed` from `@whop/checkout/react`.
- `onComplete` starts receipt-status polling; it never marks the payment confirmed.

- [ ] **Step 1: Write failing UI tests**

Cover: first click validates and creates the tip once; Whop embed appears inline without new tab; double click cannot create a second tip; `onComplete` navigates/polls the signed receipt; an API failure unlocks retry; no card data touches TipMe state.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd test -- tests/payments/whop-checkout.test.tsx tests/ui/fan-single-screen-checkout.test.tsx
```

- [ ] **Step 3: Implement the client component**

Render:

```tsx
<WhopCheckoutEmbed
  sessionId={sessionId}
  planId={planId}
  returnUrl={receiptUrl}
  theme="light"
  onComplete={() => onPaymentSubmitted()}
/>
```

Do not enable `hideTermsAndConditions`. Use the package's documented environment prop/configuration for sandbox after confirming its installed type definition.

- [ ] **Step 4: Adapt `TipForm` to deferred embedded checkout**

Before submission show one `ENVIAR TIP` button. After `POST /api/tips`, lock identity/amount fields and replace the button area with Whop's embed plus a small `Editar tip` action that abandons the unconfirmed attempt and resets local state. Do not create the checkout during preload.

- [ ] **Step 5: Add safe return handling**

The return page requires the existing signed receipt token and renders `ReceiptStatus`; it does not accept or trust `paymentId`, `success=true` or Whop status query parameters.

- [ ] **Step 6: Re-run UI tests**

Expected: one initial TipMe action, embedded checkout, and confirmation still waits for the backend.

---

### Task 6: Verificación y normalización del webhook Whop

**Files:**
- Create: `src/features/payments/whop-webhook.ts`
- Create: `src/app/api/webhooks/whop/route.ts`
- Modify: `src/features/payments/provider.ts`
- Test: `tests/payments/whop-webhook.test.ts`
- Test: `tests/payments/webhook-signature.test.ts`

**Interfaces:**
- Verifies: `client.webhooks.unwrap(rawBody, { headers: Object.fromEntries(headers) })`.
- Produces normalized payment/refund/dispute/withdrawal events using integer minor amounts.
- Correlates Whop `pay_...` to TipMe via `checkout_configuration_id` (`ch_...`), not buyer metadata alone.

- [ ] **Step 1: Write failing signature and parser tests**

Fixtures must mirror documented Whop v1 payloads. Cover valid signature wrapper, tampered body, missing signature headers, `payment.succeeded`, `payment.pending`, `payment.failed`, `refund.updated`, `dispute.created`, `dispute.updated`, `withdrawal.updated`, and unknown event.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd test -- tests/payments/whop-webhook.test.ts tests/payments/webhook-signature.test.ts
```

- [ ] **Step 3: Verify before parsing**

Read `request.text()` exactly once. Pass the original string and headers to the official SDK. A thrown signature error maps to HTTP 401 `invalid_webhook`; all internal failures map to a generic 500 while logs contain only event id/type, controlled code and timestamps.

- [ ] **Step 4: Normalize authoritative amounts**

Use a decimal-string conversion that rejects more fractional digits than the currency permits; never multiply an uncontrolled floating value and silently round. For a succeeded Payment derive:

```ts
gatewayFeeMinor = totalMinor - applicationFeeMinor - amountAfterFeesMinor
```

Validate the result is between `0` and `totalMinor - applicationFeeMinor`. If Whop's installed type exposes a direct processing-fee amount, prefer it and assert it reconciles with the equation.

- [ ] **Step 5: Correlate and cross-check ownership**

Require all of:

- `company_id` equals the stored connected company for the tip's creator;
- payment currency is USD;
- payment total equals `tips.amount_minor`;
- application fee equals `tips.platform_fee_minor`;
- checkout id maps to `tips.provider_payment_id`.

Store Whop's `pay_...` as `tips.provider_capture_id` only after these checks.

- [ ] **Step 6: Return 2xx for safely ignored supported events**

Unknown or irrelevant Whop events are recorded as ignored and return 200 so Whop does not retry forever. Invalid signatures and transient database failures must not return 200.

- [ ] **Step 7: Re-run focused tests**

Expected: tampering fails, decimals remain exact, and no client parameter can confirm a tip.

---

### Task 7: Confirmación, ledger, idempotencia y push con Whop

**Files:**
- Create: `src/features/payments/whop-webhook-handler.ts`
- Modify: `src/features/payments/supabase-webhook-repository.ts`
- Modify: `src/features/payments/process-webhook.ts`
- Modify: `src/app/api/webhooks/whop/route.ts`
- Test: `tests/payments/process-whop-webhook.test.ts`
- Test: `tests/push/push.test.ts`

- [ ] **Step 1: Write failing end-to-end service tests**

Cover the critical sequence with real TipMe services and only Whop/Supabase boundaries faked: valid success confirms once, creates exact ledger entries, one logical notification and push to all active devices; pending/failed do not push; duplicate success returns duplicate; success with wrong connected company or amount fails closed.

For a `$20.00` tip at 1% with a Whop net of `$18.96`, assert literal ledger values:

```ts
[
  { type: "tip_confirmed", amountMinor: 2000 },
  { type: "platform_fee", amountMinor: -20 },
  { type: "gateway_fee", amountMinor: -84 },
]
```

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd test -- tests/payments/process-whop-webhook.test.ts tests/push/push.test.ts
```

- [ ] **Step 3: Reuse the existing transaction boundary**

Route Whop payment events through `confirm_tip_from_webhook`, `reject_tip_from_webhook` and the existing push service. Set repository provider explicitly to `whop`; do not depend on the global provider inside a request after construction.

- [ ] **Step 4: Preserve logical notification idempotency**

The existing unique `(provider, provider_event_id)` and one `tip_confirmed` notification per tip remain the final guard. Call `markPushAttempted` before sending. Multiple device deliveries are one logical notification, not duplicates.

- [ ] **Step 5: Record latency timestamps**

Map Whop `timestamp`/payment `paid_at` into `provider_confirmed_at`; existing `received_at`, tip `confirmed_at` and `push_attempted_at` complete the required latency trail.

- [ ] **Step 6: Re-run focused tests**

Expected: core payment-to-push flow passes and wrong/duplicate events cannot move money.

---

### Task 8: Reembolsos y disputas parciales de Whop

**Files:**
- Modify: `src/features/payments/whop-webhook.ts`
- Modify: `src/features/payments/whop-webhook-handler.ts`
- Modify: `src/features/payments/supabase-webhook-repository.ts`
- Test: `tests/payments/whop-adjustments.test.ts`
- Test: `tests/domain/money.test.ts`

- [ ] **Step 1: Write failing financial-adjustment tests**

Cover: pending refund records no ledger; succeeded partial refund debits proportional creator exposure once; a second partial refund adds only its amount; duplicate update does nothing; failed/canceled refund does nothing; dispute creation holds once; won dispute releases the hold; lost dispute converts hold to chargeback without a double debit; events before payment confirmation are safely retained/ignored for replay investigation.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd test -- tests/payments/whop-adjustments.test.ts tests/domain/money.test.ts
```

- [ ] **Step 3: Define proportional creator exposure explicitly**

For a partial reversal of gross `R` from gross payment `G`, debit no more than the remaining creator credit and calculate with integer arithmetic:

```ts
creatorDebit = Math.min(
  remainingCreatorCredit,
  Math.ceil((creatorCreditedMinor * reversalGrossMinor) / paymentGrossMinor),
);
```

For the final remainder, debit exactly `remainingCreatorCredit` so rounding cannot leave phantom cents.

- [ ] **Step 4: Call the new SQL RPCs**

Keep calculation validation in TypeScript and enforce cumulative limits again in PostgreSQL. Store Whop refund/dispute IDs and provider status, never buyer/card details.

- [ ] **Step 5: Add internal notifications without false push claims**

Create a creator notification for a completed refund, dispute hold, dispute win/loss. Push may be sent for a chargeback or material balance change, but its copy must not reveal buyer financial details.

- [ ] **Step 6: Re-run focused tests**

Expected: ledger can be reconstructed exactly and duplicated/out-of-order updates remain safe.

---

### Task 9: Portal de retiros hospedado por Whop

**Files:**
- Create: `src/app/api/whop/payouts/portal/route.ts`
- Create: `src/app/api/whop/payouts/return/route.ts`
- Create: `src/components/payouts/whop-funds-panel.tsx`
- Modify: `src/app/dashboard/payouts/page.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Test: `tests/payouts/whop-payout-portal.test.ts`
- Test: `tests/ui/dashboard-whop-status.test.tsx`

**Interfaces:**
- Calls: `accountLinks.create({ company_id, use_case: "payouts_portal", return_url, refresh_url })`.
- Does not call TipMe's `request_platform_payout` in Whop mode.

- [ ] **Step 1: Write failing authorization/UI tests**

Cover: only the authenticated owner can obtain a portal link; company id comes from the database; another creator's id in query/body is ignored/rejected; disconnected account cannot open portal; dashboard shows `Whop conectado`; PayPal payout controls never render in Whop mode.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npm.cmd test -- tests/payouts/whop-payout-portal.test.ts tests/ui/dashboard-whop-status.test.tsx
```

- [ ] **Step 3: Implement hosted payout link**

Authenticate, load `findConnected(user.id, "whop")`, create a short-lived `payouts_portal` account link and return a 303 redirect to its URL. The refresh route generates a new link after re-authentication. Return route redirects to `/dashboard/payouts?whop=returned` and never asserts that a withdrawal completed.

- [ ] **Step 4: Replace payout UX only in Whop mode**

Show the TipMe ledger estimate and clearly label Whop as the authoritative balance/withdrawal service. Primary action: `Administrar retiros en Whop`. Keep existing PayPal and mock pages behind their provider branches.

- [ ] **Step 5: Re-run focused tests**

Expected: no TipMe custody/payout API is invoked in Whop mode and no IDOR is possible.

---

### Task 10: Estado de KYC y retiros por webhook

**Files:**
- Modify: `src/features/payments/whop-webhook.ts`
- Modify: `src/features/payments/whop-webhook-handler.ts`
- Create: `src/features/payouts/whop-withdrawal-repository.ts`
- Create: `supabase/migrations/202608200006_whop_withdrawals.sql`
- Test: `tests/payouts/whop-withdrawals.test.ts`

- [ ] **Step 1: Inspect installed SDK types and official webhook fixtures**

Before defining columns, confirm exact ids, amount, currency, status and company relationship for `verification.succeeded`, `payout_account.status_updated`, `withdrawal.created` and `withdrawal.updated`.

- [ ] **Step 2: Write failing transition tests**

Cover: verification marks only the matching child company ready; completed withdrawal produces one negative `payout` ledger entry; failed withdrawal does not reduce available balance; duplicate update does nothing; completed/failure notifications and push are single logical events; another company's withdrawal is rejected.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
npm.cmd test -- tests/payouts/whop-withdrawals.test.ts
```

- [ ] **Step 4: Add provider-withdrawal audit storage**

Create an additive private table keyed by `(provider, provider_withdrawal_id)`, linked to creator and connected company, with integer amount/currency/status/timestamps. Create a local `payouts` row only when required to reference existing notification/ledger constraints; use a service-owned Whop payout account and never store bank details.

- [ ] **Step 5: Implement state-machine RPC**

Allowed transitions are provider-documented transitions only. `completed` inserts one negative payout ledger entry and one notification. `failed` creates a failure notification without a negative ledger entry. If Whop first reports processing and later completed, update the same local payout.

- [ ] **Step 6: Reconcile dashboard wording**

After a withdrawal webhook, TipMe's derived ledger reflects it. Until that event arrives, label TipMe's amount as an estimate and direct the creator to Whop for the authoritative withdrawable balance.

- [ ] **Step 7: Re-run focused tests**

Expected: completed withdrawals reduce the reconstructed ledger exactly once and produce the required push.

---

### Task 11: Textos legales, i18n y errores seguros

**Files:**
- Modify: `src/features/legal/terms.ts`
- Modify: `src/features/legal/content.ts`
- Modify: `src/components/tips/tip-form.tsx`
- Modify: `src/lib/i18n/dictionaries.ts`
- Test: `tests/ui/fan-legal-consent.test.tsx`
- Test: `tests/legal/legal-pages.test.tsx`

- [ ] **Step 1: Write failing behavior tests**

Assert the fan cannot create a tip without accepting the current terms version and the UI no longer claims `no es una compra` or describes PayPal custody when Whop is active.

- [ ] **Step 2: Update the legal acceptance copy**

Use concise Spanish/English wording equivalent to:

> Este tip apoya el contenido o servicio digital público de este creador. No es una remesa, préstamo, reembolso, donación benéfica ni pago por actividades prohibidas. Acepto los Términos y la Política de reembolsos.

Update the version constant so new tips store the new acceptance. Do not retroactively rewrite prior acceptance records.

- [ ] **Step 3: Make provider wording factual**

Terms: Whop processes payment, connected account, fees, KYC, disputes and withdrawals under its terms. Privacy: TipMe receives provider identifiers and financial event metadata but not full card data. Refunds: they return through the original payment and may be controlled by Whop/issuer.

- [ ] **Step 4: Add safe user-facing error mapping**

Map provider denial, account not connected, checkout unavailable, payment pending/rejected, webhook failure and portal unavailable. Never render raw SDK messages, response bodies, stack traces or secret-bearing errors.

- [ ] **Step 5: Re-run focused tests**

Expected: current terms are required, bilingual copy is accurate, provider failures are nontechnical.

---

### Task 12: README, deployment and proportionate verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `docs/superpowers/plans/2026-08-20-whop-platform-payments.md`

- [ ] **Step 1: Document sandbox setup**

Include:

1. create/use the separate Whop sandbox company and Company API key;
2. configure `WHOP_ENVIRONMENT=sandbox`;
3. set webhook URL `https://<public-host>/api/webhooks/whop` (localhost needs a tunnel);
4. enable child-resource events;
5. subscribe only to payment, refund, dispute, verification, payout-account and withdrawal events used by TipMe;
6. note sandbox supports checkout/card/webhooks but not KYC/payout completion or wallets.

- [ ] **Step 2: Document live gate honestly**

State that live connected accounts/direct charges require Whop for Platforms approval and policy confirmation for TipMe's exact commercial tipping model. Code readiness does not equal provider approval.

- [ ] **Step 3: Document Vercel variables**

Separate Sandbox/Preview and Production values. `WHOP_API_KEY` and `WHOP_WEBHOOK_SECRET` are server-only and must never use `NEXT_PUBLIC_`. Production app URL is `https://tipme.pro`.

- [ ] **Step 4: Run focused financial and push suite**

```powershell
npm.cmd test -- tests/payments tests/payouts tests/push tests/domain/money.test.ts tests/database/migration-safety.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run static verification**

```powershell
npm.cmd run typecheck
npm.cmd run lint
```

Expected: PASS with no ignored errors.

- [ ] **Step 6: Run production build**

```powershell
npm.cmd run build
```

Expected: PASS; no server secret appears in generated public chunks.

- [ ] **Step 7: Perform the shortest meaningful manual sandbox test**

1. creator completes TipMe onboarding and receives a Whop sandbox child company;
2. fan opens public URL without auth and submits `$20`;
3. embedded Whop sandbox checkout remains inside TipMe;
4. signed `payment.succeeded` confirms the tip;
5. ledger shows `$20.00`, `-$0.20` TipMe and the real Whop fee;
6. one notification/push is generated and receipt operation code is visible;
7. replay the same webhook and confirm no money/push duplication;
8. send a partial refund/dispute test event and confirm the exact adjustment once.

- [ ] **Step 8: Record manual live-only checks as pending, not passing**

KYC, real payout portal withdrawal, Apple Pay/Google Pay and real-card latency must be checked with a consenting pilot account after Whop enables production. Do not claim these work based only on sandbox.

