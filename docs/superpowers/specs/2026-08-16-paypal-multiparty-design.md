# TipMe PayPal Multiparty Design

**Date:** 2026-08-16

## Goal

Add PayPal Multiparty as an optional payment provider so a supporter can pay an embedded credit/debit card form or PayPal wallet, PayPal can disburse the creator's share directly to the creator's connected PayPal account, and TipMe can record and notify only after a verified PayPal webhook.

## Scope

- Keep `PAYMENT_PROVIDER=mock` fully functional for local and pilot testing.
- Add `PAYMENT_PROVIDER=paypal` for PayPal Sandbox and, only after PayPal approval, Live.
- Add PayPal seller onboarding and store only verified provider identifiers and capability state.
- Add embedded PayPal Card Fields with PayPal Buttons as fallback.
- Create and capture PayPal orders server-side.
- Verify PayPal webhooks using PayPal's verification API and the exact raw request body and transmission headers.
- Map verified capture events into the existing tip, ledger, notification, and Web Push flow.
- Preserve configurable `PLATFORM_FEE_BPS` and USD-only payments.
- Replace TipMe-controlled payouts with a PayPal account-management action while PayPal is active.

The integration will not process live money until TipMe has PayPal Multiparty, Partner Fee, and advanced card-payment approval. It will not implement subscriptions, saved cards, vaulting, multiple currencies, or APIs invented for an unapproved PayPal product.

## User Experience

### Creator onboarding

When `PAYMENT_PROVIDER=mock`, onboarding remains unchanged.

When `PAYMENT_PROVIDER=paypal`, step 2 displays `Conectar PayPal`. The authenticated creator is redirected to PayPal's official seller-onboarding flow. After PayPal redirects back, TipMe queries PayPal server-side and marks the connection ready only when the merchant has completed onboarding, confirmed the email, can receive payments, and has the required card-payment capability.

TipMe never asks for or stores a PayPal password, card number, CVV, bank account number, identity document, or PayPal access token belonging to a creator.

### Supporter checkout

The public creator page keeps the current amount, optional name, optional message, and anonymous controls. Selecting `ENVIAR TIP` creates a pending TipMe tip and a PayPal order, then reveals an embedded payment panel on the same page.

The panel gives priority to PayPal Card Fields and includes a PayPal Button as an alternative. Card Fields are secure PayPal-hosted frames styled to match TipMe. If PayPal reports that Card Fields are ineligible, TipMe hides them and keeps the PayPal Button. The interface never promises that card checkout is available in every country.

After payer approval, the browser asks a protected TipMe endpoint to capture the existing order. A successful capture response changes the supporter view to `Confirmando pago`; it does not confirm the tip or alter the ledger. The existing status endpoint is polled until the verified webhook changes the tip to a terminal state, then the supporter is sent to the receipt.

### Dashboard and payouts

Mock mode retains the current mock balance and payout simulator.

PayPal mode labels financial figures as TipMe's transaction record and `Disponible en PayPal`. It does not represent the amount as money held or withdrawable by TipMe. The payout action becomes `Administrar en PayPal` and sends the creator to PayPal. PayPal controls bank withdrawal timing, eligibility, holds, and fees.

## Architecture

### Provider boundary

The provider interface will support:

- payment creation;
- payment capture;
- payment status lookup;
- asynchronous webhook verification using the raw body and request headers;
- webhook parsing;
- provider-specific checkout presentation;
- existing mock payouts only.

`MockPaymentProvider` continues returning a redirect checkout. `PayPalPaymentProvider` returns embedded checkout data: PayPal order ID, connected merchant ID, client ID, and a short-lived client token when required by Card Fields.

PayPal REST access tokens are requested and cached server-side. The PayPal client secret, webhook ID, partner merchant ID, BN code, and access tokens never reach the browser. The public PayPal client ID and connected merchant ID may be sent to the browser because the PayPal JavaScript SDK requires them.

### Data model

Add `payment_accounts` with:

- `id` UUID primary key;
- `creator_id` referencing `profiles(id)`;
- `provider` constrained initially to `paypal`;
- `provider_merchant_id`;
- `status`: `pending`, `connected`, `restricted`, or `disconnected`;
- `onboarding_completed`;
- `email_confirmed`;
- `payments_receivable`;
- `card_payments_enabled`;
- `connected_at`, `created_at`, and `updated_at`.

There is one account per creator/provider. Creators can read their own connection status. Only trusted server code can insert or modify provider identifiers and capability state. RLS prevents one creator from reading another creator's payment account.

The existing `tips`, `ledger_entries`, `webhook_events`, `notifications`, and `push_subscriptions` remain the financial source of truth. No editable balance column is introduced.

Add nullable `provider_capture_id` to `tips`, unique together with `provider` when present. `provider_payment_id` remains the PayPal order ID created before payer approval; `provider_capture_id` records the capture returned by PayPal without confirming the tip. This distinction lets completion, refund, and reversal events resolve the same tip safely.

### PayPal order creation

The server validates the supporter input, resolves the public creator, and requires a connected PayPal payment account. It inserts the tip, calculates the configured platform fee in integer minor units, then creates a PayPal USD order with:

- `intent: CAPTURE`;
- the connected creator as payee;
- an application context that describes a voluntary tip without goods or services;
- the configured platform fee when non-zero;
- idempotent TipMe and PayPal request identifiers.

The PayPal order ID is stored as `provider_payment_id`. Failures leave no confirmed money and return a generic supporter-facing error while logging a safe provider diagnostic server-side.

### Capture

The capture endpoint accepts only a TipMe tip identifier plus its unguessable receipt authorization. It loads the stored PayPal order ID and refuses to capture an order belonging to a different tip or provider. A successful provider response may attach `provider_capture_id` and set the tip to `pending`, but never confirms it or writes ledger entries. Repeated capture calls are safe and never mutate the ledger.

### Webhook verification and mapping

PayPal webhook verification is asynchronous. TipMe sends the exact raw event plus `paypal-auth-algo`, `paypal-cert-url`, `paypal-transmission-id`, `paypal-transmission-sig`, `paypal-transmission-time`, and the configured PayPal webhook ID to PayPal's verification endpoint. Processing stops unless PayPal returns `SUCCESS`.

Supported mappings:

- `PAYMENT.CAPTURE.PENDING` -> `pending`;
- `PAYMENT.CAPTURE.COMPLETED` -> `confirmed`;
- `PAYMENT.CAPTURE.DECLINED` or legacy `PAYMENT.CAPTURE.DENIED` -> `rejected`;
- `PAYMENT.CAPTURE.REFUNDED` -> `refunded`;
- `PAYMENT.CAPTURE.REVERSED` -> `chargeback`.

The adapter extracts both PayPal order and capture identifiers when present. Completion and pending events resolve the tip through `supplementary_data.related_ids.order_id` and attach the capture ID. Refund and reversal events resolve it through the related capture ID. An event that cannot be correlated unambiguously is recorded as failed or ignored without changing money. Unknown events are recorded as ignored and do not change tips, ledger entries, notifications, or balances.

Only full refunds are mapped to the MVP's terminal `refunded` state. A partial refund is recorded for administrative review without applying an incorrect full reversal; partial-refund ledger support is outside this integration scope.

When `seller_receivable_breakdown.paypal_fee` is present and matches USD, it becomes `gateway_fee_minor`. Otherwise the gateway fee stays `null`; TipMe never invents a fee. The stored platform fee remains the fee requested when the order was created.

The existing database transaction functions retain idempotency through `(provider, provider_event_id)` and `(provider, provider_payment_id)`. A duplicate PayPal delivery produces neither duplicate ledger entries nor a duplicate logical notification. Push is attempted only after a newly processed confirmation.

## Security and failure handling

- Validate all public input server-side and preserve existing rate limits.
- Add rate limits to onboarding, client-token, order-capture, and webhook endpoints where appropriate.
- Use the PayPal Sandbox base URL unless `PAYPAL_ENVIRONMENT=live` is explicitly selected.
- Reject `PAYPAL_ENVIRONMENT=live` when required live configuration is absent.
- Never infer confirmation from `onApprove`, a redirect query, or a capture response.
- Redact PayPal tokens, secrets, authorization headers, card data, payer email, and raw sensitive provider errors from logs.
- Keep anonymous payer identity absent from creator-facing records and push content.
- Show safe UI states for ineligible cards, declined payment, pending payment, blocked popup, network failure, and webhook delay.
- Do not save cards or payer PayPal accounts in this MVP.

## Environment

Add fake placeholders to `.env.example`:

```dotenv
PAYMENT_PROVIDER=mock
PAYPAL_ENVIRONMENT=sandbox
NEXT_PUBLIC_PAYPAL_CLIENT_ID=fake-paypal-client-id-replace-me
PAYPAL_CLIENT_SECRET=fake-paypal-client-secret-replace-me
PAYPAL_WEBHOOK_ID=fake-paypal-webhook-id-replace-me
PAYPAL_PARTNER_MERCHANT_ID=fake-paypal-partner-merchant-id-replace-me
PAYPAL_PARTNER_ATTRIBUTION_ID=fake-paypal-bn-code-replace-me
RECEIPT_SIGNING_SECRET=fake-receipt-signing-secret-change-me
```

Real values belong only in `.env.local` and Vercel. `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is the only PayPal credential intentionally public. Receipt authorization uses `RECEIPT_SIGNING_SECRET`, not the mock webhook secret, in every provider mode.

## Focused verification

Automated tests will cover the highest-risk behavior without duplicating PayPal's own SDK tests:

1. Provider selection preserves mock and enables PayPal only with valid configuration.
2. A creator without a connected PayPal account cannot accept a PayPal tip.
3. PayPal orders contain the creator payee and configured platform fee.
4. Capture cannot target another tip/order and does not confirm a tip.
5. Invalid PayPal webhook verification has no financial or push side effects.
6. Completed capture confirms once and triggers one logical notification.
7. Duplicate delivery does not duplicate ledger or push.
8. Pending and declined captures do not send a received-tip push.
9. Refund and reversal use the existing balance-correction flow.
10. Anonymous tips never expose payer identity.
11. Missing PayPal fee stays provisional; a real fee is recorded in minor units.
12. RLS isolates creator payment accounts.
13. Mock payment and payout tests continue passing.

Final verification runs targeted tests during development, then the complete test suite, typecheck, lint, and production build. Real-device push testing and real PayPal payment testing remain manual because they require the user's Sandbox/Live accounts and devices.

## User-provided setup after implementation

The user will:

1. Create or verify a dedicated PayPal Business account for TipMe.
2. Create Sandbox buyer and seller accounts.
3. Create a PayPal REST application.
4. Request Multiparty, Partner Fee, and advanced card-payment access.
5. Configure the HTTPS webhook URL and copy its webhook ID.
6. Put sandbox credentials in `.env.local` and Vercel without sharing secrets in chat.
7. Connect a sandbox creator through TipMe and execute the manual end-to-end checklist.

## Acceptance criteria

- Mock mode remains operational with no PayPal credentials.
- PayPal mode fails safely when configuration or seller connection is incomplete.
- An eligible supporter can pay in the embedded card form without a TipMe or PayPal account.
- A supporter can choose the PayPal wallet button instead.
- Capture from the browser never confirms or credits the tip.
- Only a verified completed PayPal capture webhook confirms the tip, writes ledger entries, creates one notification, and attempts push.
- The creator's PayPal account is the destination of funds and TipMe never offers an internal PayPal withdrawal.
- No PayPal private credential or card data is exposed to the browser, database, logs, or repository.
