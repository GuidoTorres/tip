# PayPal Standard Sandbox Design

## Goal

Allow TipMe to exercise a real PayPal Sandbox checkout, capture, verified webhook, ledger, balance, receipt, realtime refresh, and push notification before PayPal grants Multiparty partner capabilities.

## Safety boundary

The fallback is available only when `PAYPAL_ENVIRONMENT=sandbox` and `PAYPAL_SANDBOX_SINGLE_MERCHANT=true`. Configuration validation must reject this fallback in `live`. It must never claim that creator funds or the TipMe fee were split by PayPal.

## Configuration

- `PAYMENT_PROVIDER=paypal`
- `PAYPAL_ENVIRONMENT=sandbox`
- `PAYPAL_SANDBOX_SINGLE_MERCHANT=true`
- Client ID, secret, webhook ID, platform Sandbox merchant ID, and receipt signing secret remain required.
- `PAYPAL_PARTNER_ATTRIBUTION_ID` becomes optional. When absent, neither REST requests nor the JavaScript SDK include the BN Code.

## Creator onboarding

In this fallback, onboarding displays a clearly labelled simulated PayPal Sandbox connection and allows the creator to continue without entering PayPal credentials. It does not create a connected seller record or claim PayPal verification. The existing Partner Referrals onboarding remains unchanged for real Multiparty mode.

## Checkout and money flow

Standard mode creates the order for TipMe's own Sandbox merchant. It omits `PayPal-Auth-Assertion`, creator `payee`, and PayPal `platform_fees`. Card Fields and the PayPal button remain embedded. The browser requests capture but never confirms financial state.

PayPal sends the real Sandbox webhook. Existing signature verification, idempotency, tip confirmation, ledger entries, realtime refresh, receipt, and push processing remain the source of truth. The configured 3% is represented only inside TipMe's Sandbox ledger; PayPal does not actually split it.

## Interface disclosure

Creator onboarding and money screens show that payments are being processed through TipMe's single Sandbox merchant account. Public fan checkout keeps the normal PayPal Sandbox experience. Production does not expose this disclosure or fallback because configuration validation blocks it.

## Errors and tests

- Reject single-merchant fallback outside Sandbox.
- Omit BN headers and SDK attributes when no BN Code exists.
- Ensure standard orders omit partner-only fields.
- Ensure checkout capture still waits for a verified webhook.
- Preserve existing Multiparty and mock behavior.
- Verify typecheck, lint, focused tests, full tests, and production build.

## Deliberate limitations

This mode does not validate or connect creator PayPal accounts, route funds to creators, or test the real partner fee. Those capabilities continue to require PayPal Multiparty approval.
