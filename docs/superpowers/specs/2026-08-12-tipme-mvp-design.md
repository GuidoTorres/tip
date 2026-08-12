# TipMe MVP Design

## Product goal

TipMe lets a creator register, publish `tipme.pro/<username>`, receive a confirmed tip from an unauthenticated fan, see the derived balance update, receive Web Push, and request a payout. The MVP is complete only when this flow works end to end with the mock financial provider.

The product is not a social network. It excludes chat, feeds, followers, fan accounts, subscriptions, locked content, virtual currencies, native apps, and marketplaces.

## Scope and delivery strategy

The repository starts empty. The application will be a single Next.js App Router project with Supabase as its remote system of record and Vercel as its target runtime.

`.env.example` will contain safe fake values. Lint, typecheck, unit tests, and the production build must work without real secrets. Integrated authentication, database, Realtime, Storage, and Web Push require the user to replace those values with a Supabase project and VAPID keys.

Tests are intentionally concentrated on money, authorization, webhook authenticity, idempotency, anonymity, payouts, and push dispatch behavior. Cosmetic snapshots and low-value exhaustive UI tests are excluded.

## Technical architecture

- Next.js stable, App Router, TypeScript, Tailwind CSS v4.
- React Server Components for fast public and authenticated reads.
- Small Client Component islands for forms, Supabase Realtime, install prompts, notification permissions, and Web Share.
- Supabase Auth for `creator` and `admin` users.
- PostgreSQL and Supabase RLS as the source of truth.
- Supabase Storage for validated profile photos.
- Route Handlers for payment creation, mock gateway actions, webhooks, push subscriptions, and payouts.
- SQL transactions/functions for state transitions that must be atomic.
- A typed `PaymentProvider` interface with `MockPaymentProvider`. Future real providers are adapters and do not alter application flows.
- Native Service Worker, Push API, Notifications API, Web App Manifest, Badging API when available, and VAPID via the minimal `web-push` server dependency.
- No ORM, global client state library, microservices, or editable balance column.

## Domain boundaries

- `auth`: sessions, signup, login, roles, protected routes.
- `profiles`: public creator identity, locale, country, preferred currency, onboarding state.
- `payments`: tip intent creation and provider abstraction.
- `webhooks`: signature validation, replay/duplicate protection, event logging, transition dispatch.
- `ledger`: immutable money movements and balance reconstruction.
- `payouts`: verified payout references and withdrawal state transitions.
- `notifications`: one logical database notification per financial event.
- `push`: device subscriptions and delivery attempts to all active endpoints.
- `admin`: protected operational visibility and audited sensitive actions.

## Core payment flow

1. An unauthenticated fan submits a tip to a public creator profile.
2. The server validates creator, amount, supported currency, message length, anonymity, and rate limits.
3. The server calculates the platform fee from `PLATFORM_FEE_BPS` and asks the configured `PaymentProvider` to create the payment.
4. In non-production environments, the mock gateway can emit an approved, pending, or rejected signed event.
5. `/api/webhooks/payments` verifies authenticity before parsing or changing state.
6. A database transaction records the unique webhook event and applies an allowed state transition.
7. A confirmed tip creates immutable ledger entries and exactly one internal notification.
8. After the transaction commits, the backend sends Web Push to every active subscription.
9. Supabase Realtime refreshes the open dashboard. The ledger remains the source of truth even if Realtime or Push fails.

The browser never confirms a tip or mutates a balance. Duplicate webhooks cannot duplicate money or logical notifications.

## Money model

All amounts use integer minor units and ISO currency codes. Initially supported currencies are USD, EUR, PEN, COP, BRL, CLP, and ARS.

For a confirmed tip, ledger entries represent gross receipt, platform fee, and gateway fee only when the provider reports a real fee. `gateway_fee_minor` remains nullable otherwise. Refunds and chargebacks create compensating immutable entries. Payout requests reserve/deduct available funds atomically and can never exceed the reconstructed available balance.

Balances are grouped per currency. The MVP does not convert currencies.

## Data model

Migrations will define:

- `profiles`: role, public identity, username, country, locale, currency, onboarding metadata.
- `tips`: creator, optional payer data, anonymity, monetary breakdown, provider references, status timestamps.
- `ledger_entries`: immutable signed movements linked to a tip or payout.
- `payout_accounts`: provider token/reference, bank name, last four digits, country, verification state.
- `payouts`: amount, currency, provider reference, status and timestamps.
- `webhook_events`: provider event identity, verified payload digest, processing state, timestamps, error summary.
- `notifications`: creator, type, safe title/body, related tip/payout, read state.
- `push_subscriptions`: creator, endpoint and keys, device metadata, usage/revocation timestamps.
- `admin_audit_logs`: actor, action, controlled metadata, timestamp.

Foreign keys, unique constraints, state and amount checks, indexes, timestamps, RLS, and grants are explicit. Public access is through a constrained public-profile query/function, not unrestricted table reads.

## Security model

- Service role, gateway secrets, VAPID private key, and mock webhook secret remain server-only.
- RLS scopes every private row to its creator. Admin access is derived server-side from protected role data.
- Fans have no account and cannot query private tips, ledger, payouts, notifications, or push subscriptions.
- Inputs are validated server-side with narrow, reusable validators.
- Sensitive endpoints receive basic IP/request-key rate limiting suitable for a serverless MVP.
- Mock approval and payout simulation routes return 404 in production.
- Webhook signatures use constant-time comparison and timestamp tolerance to reduce replay risk.
- Full card data, CVV, bank credentials, and unnecessary banking data are never accepted or stored.
- Anonymous tips never expose payer identity in creator UI, database notification copy, or push payloads.

## UX design

Design read: a mobile-first consumer finance product for creators, with a warm, reliable, direct language. The visual foundation is custom Tailwind, not a heavy component system.

- `DESIGN_VARIANCE: 5`: modest asymmetry on marketing/public surfaces, strict single-column mobile flows.
- `MOTION_INTENSITY: 3`: tactile hover/press and state feedback only.
- `VISUAL_DENSITY: 5`: compact enough for daily mobile use without becoming an enterprise dashboard.
- One light/dark-aware neutral palette with a single coral accent.
- Geist through `next/font`, 16 px surfaces, rounded action buttons, minimum 44 px touch targets.
- Spanish and English typed dictionaries. Locale is detected and can be changed manually.
- Public creator page prioritizes creator identity, amount selection, optional fan data, anonymity, and one `ENVIAR TIP` action.
- Dashboard prioritizes available balance, pending balance, withdrawal action, today/month totals, and recent tips. No charts.
- Onboarding has four short stages: profile, mock payout account, notifications, link sharing.
- iOS installed-PWA requirements are explained briefly before requesting permission. Permission always follows an explicit user action.
- Loading, empty, pending, rejected, offline, blocked-push, missing-creator, insufficient-balance, and unknown-error states use nontechnical copy.

## Routes

Public routes include `/`, `/signup`, `/login`, `/onboarding`, `/[username]`, payment status/receipt routes, the manifest, service worker, and APIs.

Authenticated creator routes include `/dashboard`, `/dashboard/tips/[tipId]`, `/dashboard/payouts`, `/dashboard/notifications`, `/dashboard/settings`, and `/dashboard/settings/notifications`.

Admin routes live under `/admin` and expose a minimal protected operational overview only.

## Push and Realtime

Creators may register multiple subscriptions. A confirmed tip or terminal payout event creates one logical notification and then fans out to active devices. Expired endpoints are revoked. Push payloads contain only safe display text and a deep link.

The service worker displays notifications, updates the badge when supported, and opens `/dashboard/tips/<id>` or `/dashboard`. Push failure never rolls back confirmed money. Realtime listens to the authenticated creator's tips and notifications, then revalidates server-derived balances rather than calculating money in the client.

## Error handling and observability

User responses expose stable error codes and localized, nontechnical messages. Server logs include request/event identifiers but exclude secrets and sensitive payer/payment data.

Payment timing records provider confirmation time when supplied, webhook receipt time, database confirmation time, and push-attempt time. No user-facing latency promise is made.

Failed verified webhooks remain inspectable and retryable without duplicating completed effects. Invalid webhooks are rejected and do not create financial or notification state.

## Verification

Automated tests cover:

- unauthenticated tip creation validation;
- fee calculations using configurable basis points;
- valid/invalid/duplicate webhook behavior;
- allowed tip state transitions;
- immutable ledger reconstruction, refunds, and chargebacks;
- payout available-balance enforcement and completion effects;
- creator isolation and public/private access policies;
- push creation rules, anonymity, multi-device delivery, endpoint revocation, and payout notifications.

Every major stage runs focused tests, typecheck, and lint. Final verification runs the full test suite and production build.

Physical iPhone/iPad and Android Web Push verification requires the user's devices and deployed HTTPS URL. The README will provide the exact checklist and expected evidence.

## User-supplied steps

The user will only need to:

1. Create or select a Supabase project.
2. Apply the included migrations and optional demo seed.
3. Copy Supabase credentials into `.env.local`.
4. Generate or supply VAPID keys and set the VAPID variables.
5. Deploy to Vercel and copy the same environment variables.
6. Perform the documented push checks on real iPhone/iPad and Android devices.

All other application code, migrations, mock financial flows, automated checks, and deployment documentation belong to this implementation.
