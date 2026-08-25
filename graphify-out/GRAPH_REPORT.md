# Graph Report - .  (2026-08-22)

## Corpus Check
- 290 files · ~96,635 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 897 nodes · 1950 edges · 47 communities (35 shown, 12 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.82)
- Token cost: 459,314 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Mercado Pago Payment Provider|Mercado Pago Payment Provider]]
- [[_COMMUNITY_Dashboard Balance UI|Dashboard Balance UI]]
- [[_COMMUNITY_App Layout & Home|App Layout & Home]]
- [[_COMMUNITY_Mercado Pago OAuth Client|Mercado Pago OAuth Client]]
- [[_COMMUNITY_Creator QR Sharing|Creator QR Sharing]]
- [[_COMMUNITY_Payment Account Repository|Payment Account Repository]]
- [[_COMMUNITY_Auth Actions & Shell|Auth Actions & Shell]]
- [[_COMMUNITY_Mock Payment & Capture|Mock Payment & Capture]]
- [[_COMMUNITY_Manual Checklists & Early Plans|Manual Checklists & Early Plans]]
- [[_COMMUNITY_Payment Provider Design Specs|Payment Provider Design Specs]]
- [[_COMMUNITY_Project Dependencies|Project Dependencies]]
- [[_COMMUNITY_Push Notification Sender|Push Notification Sender]]
- [[_COMMUNITY_Mercado Pago Currency Quotes|Mercado Pago Currency Quotes]]
- [[_COMMUNITY_Push Subscription Client|Push Subscription Client]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Admin Panel Guard|Admin Panel Guard]]
- [[_COMMUNITY_Tip Fee Calculations|Tip Fee Calculations]]
- [[_COMMUNITY_Checkout Config & Payout Destination|Checkout Config & Payout Destination]]
- [[_COMMUNITY_Create Tip Use Case|Create Tip Use Case]]
- [[_COMMUNITY_DB Migration Safety Tests|DB Migration Safety Tests]]
- [[_COMMUNITY_Currency & Ledger Types|Currency & Ledger Types]]
- [[_COMMUNITY_Tip Repository & Tests|Tip Repository & Tests]]
- [[_COMMUNITY_Session Refresh Proxy|Session Refresh Proxy]]
- [[_COMMUNITY_PWA Icon Conventions|PWA Icon Conventions]]
- [[_COMMUNITY_Agent Rules Docs|Agent Rules Docs]]
- [[_COMMUNITY_Google Play Icon Assets|Google Play Icon Assets]]
- [[_COMMUNITY_Notification Badge Icon|Notification Badge Icon]]
- [[_COMMUNITY_App Icon 192px|App Icon 192px]]
- [[_COMMUNITY_App Icon 512px|App Icon 512px]]
- [[_COMMUNITY_App Icon Source SVG|App Icon Source SVG]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PayPal Onboarding Callback Test|PayPal Onboarding Callback Test]]
- [[_COMMUNITY_PayPal Onboarding Status Test|PayPal Onboarding Status Test]]
- [[_COMMUNITY_Service Worker Shell|Service Worker Shell]]
- [[_COMMUNITY_Auth & Icon Design Docs|Auth & Icon Design Docs]]
- [[_COMMUNITY_Favicon Brand Mark|Favicon Brand Mark]]
- [[_COMMUNITY_Interactive Cursors Design|Interactive Cursors Design]]

## God Nodes (most connected - your core abstractions)
1. `createServerSupabaseClient()` - 47 edges
2. `createAdminSupabaseClient()` - 37 edges
3. `Currency` - 31 edges
4. `PayPalClient` - 25 edges
5. `PaymentProvider` - 19 edges
6. `formatMoney()` - 19 edges
7. `getRequestLocale()` - 17 edges
8. `compilerOptions` - 16 edges
9. `getMercadoPagoRegion()` - 15 edges
10. `PaymentWebhookEvent` - 15 edges

## Surprising Connections (you probably didn't know these)
- `TipMe USD Neutral Language Design` --semantically_similar_to--> `TipMe USD Local Currency Quotes Design`  [INFERRED] [semantically similar]
  docs/superpowers/specs/2026-08-16-usd-neutral-language-design.md → docs/superpowers/specs/2026-08-21-usd-local-currency-quotes-design.md
- `proxy()` --calls--> `refreshSession()`  [EXTRACTED]
  proxy.ts → src/lib/supabase/proxy.ts
- `CreatorPage()` --calls--> `NotFound()`  [INFERRED]
  src/app/[username]/page.tsx → src/app/not-found.tsx
- `AdminPayoutsPage()` --calls--> `requireAdmin()`  [INFERRED]
  src/app/admin/payouts/page.tsx → src/features/admin/guard.ts
- `AdminTipsPage()` --calls--> `requireAdmin()`  [INFERRED]
  src/app/admin/tips/page.tsx → src/features/admin/guard.ts

## Import Cycles
- 1-file cycle: `src/components/payments/paypal-onboarding-popup.tsx -> src/components/payments/paypal-onboarding-popup.tsx`

## Hyperedges (group relationships)
- **PaymentProvider Implementations** — readme_paymentprovider, readme_mockpaymentprovider, readme_paypalpaymentprovider, readme_mercadopagopaymentprovider [EXTRACTED 1.00]
- **PayPal Checkout Flow Evolution** — plans_2026_08_16_paypal_multiparty_doc, plans_2026_08_17_paypal_standard_sandbox_doc, plans_2026_08_17_paypal_card_first_fallback_doc [INFERRED 0.85]
- **Plans Extending the TipMe MVP Foundation** — plans_2026_08_12_tipme_mvp_doc, plans_2026_08_13_fix_username_constraint_doc, plans_2026_08_14_active_dashboard_navigation_doc, plans_2026_08_16_dashboard_qr_doc, plans_2026_08_16_tm_app_icons_doc [INFERRED 0.85]
- **PayPal Integration Design Lineage in TipMe** — specs_2026_08_16_paypal_multiparty_design_doc, specs_2026_08_17_paypal_card_first_fallback_design_doc, specs_2026_08_17_paypal_direct_creator_final_design_doc, specs_2026_08_17_paypal_standard_sandbox_design_doc, specs_2026_08_20_paypal_platform_payouts_design_doc, specs_2026_08_20_single_screen_paypal_checkout_design_doc [INFERRED 0.85]
- **Connected-Account No-Custody Payment Pattern** — specs_2026_08_16_paypal_multiparty_design_connected_account_model, specs_2026_08_20_whop_platform_payments_design_connected_account_model, specs_2026_08_20_mercadopago_regional_split_design_connected_account_model [INFERRED 0.85]
- **USD Currency Policy Evolution** — specs_2026_08_12_tipme_mvp_design_doc, specs_2026_08_16_usd_neutral_language_design_doc, specs_2026_08_21_usd_local_currency_quotes_design_doc [INFERRED 0.85]

## Communities (47 total, 12 thin omitted)

### Community 0 - "Mercado Pago Payment Provider"
Cohesion: 0.05
Nodes (35): MercadoPagoErrorResponse, MercadoPagoPaymentProvider, safeProviderText(), eventSchema, MockPaymentProvider, stableId(), PayPalConfig, captureFromOrder() (+27 more)

### Community 1 - "Dashboard Balance UI"
Cohesion: 0.05
Nodes (40): BalanceRefreshButton(), BalanceSummary(), BalanceSummaryProps, DashboardProfileHeader(), MercadoPagoConnectionBadge(), DashboardPage(), PayPalConnectionBadge(), RecentTip (+32 more)

### Community 2 - "App Layout & Home"
Cohesion: 0.05
Nodes (50): metadata, RootLayout(), viewport, HomePage(), getMisroutedOAuthCallback(), detectLocale(), isLocale(), Locale (+42 more)

### Community 3 - "Mercado Pago OAuth Client"
Cohesion: 0.08
Nodes (38): POST(), assertMercadoPagoSellerToken(), assertMercadoPagoUserRegion(), MercadoPagoClient, MercadoPagoOAuthToken, MercadoPagoUser, MercadoPagoConnect(), MercadoPagoCredentialManager (+30 more)

### Community 4 - "Creator QR Sharing"
Cohesion: 0.06
Nodes (35): CreatorQr(), CreatorQrProps, CreatorShareCard(), ShareQrButton(), ShareQrButtonProps, logSupabaseError(), SupabaseErrorLike, OnboardingPage() (+27 more)

### Community 5 - "Payment Account Repository"
Cohesion: 0.07
Nodes (24): POST(), SupabasePaymentAccountRepository, base64Url(), CreateOrderInput, createPayPalAuthAssertion(), PayPalClient, payPalConfigFromEnv(), RequestOptions (+16 more)

### Community 6 - "Auth Actions & Shell"
Cohesion: 0.08
Nodes (29): credentialsSchema, errorRedirect(), login(), logout(), signInWithGoogle(), signup(), AuthFields(), AuthShell() (+21 more)

### Community 7 - "Mock Payment & Capture"
Cohesion: 0.09
Nodes (30): NotFound(), POST(), MockPaymentPage(), CaptureTarget, captureTip(), CaptureTipRepository, SupabaseCaptureTipRepository, actions (+22 more)

### Community 8 - "Manual Checklists & Early Plans"
Cohesion: 0.06
Nodes (40): Google Auth Implementation Plan, OAuth PKCE return-destination flow, TipMe MVP Implementation Plan, Username Constraint Fix Implementation Plan, Repeat Tip Action Implementation Plan, Safe Supabase Error Logging Implementation Plan, Active Dashboard Navigation Implementation Plan, Interactive Cursors Implementation Plan (+32 more)

### Community 9 - "Payment Provider Design Specs"
Cohesion: 0.08
Nodes (46): PayPal Platform Payouts Implementation Plan, createCheckoutAttempt Controller, Single-Screen PayPal Checkout Implementation Plan, Whop Platform Payments Implementation Plan, USD to Local Mercado Pago Quotes Implementation Plan, TipMe MVP Design, ledger_entries Table, PaymentProvider Interface (+38 more)

### Community 10 - "Project Dependencies"
Cohesion: 0.06
Nodes (35): dependencies, mercadopago, @mercadopago/sdk-react, next, @phosphor-icons/react, qrcode, react, react-dom (+27 more)

### Community 11 - "Push Notification Sender"
Cohesion: 0.11
Nodes (24): buildTipPushPayload(), money(), PushPayload, PushSender, PushSubscriptionRow, sendCreatorPush(), shortMessage(), TipPushData (+16 more)

### Community 12 - "Mercado Pago Currency Quotes"
Cohesion: 0.18
Nodes (13): createMercadoPagoQuote(), Dependencies, schema, convertUsdMinorToLocalMinor(), currencyFractionDigits(), getMercadoPagoExchangeRate(), POST(), createPaymentQuote() (+5 more)

### Community 13 - "Push Subscription Client"
Cohesion: 0.13
Nodes (9): NotificationSettingsPage(), persistPushSubscription(), PushSubscriptionState, syncExistingPushSubscription(), subscription, subscriptionJson, PushSetup(), State (+1 more)

### Community 14 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 15 - "Admin Panel Guard"
Cohesion: 0.23
Nodes (8): requireAdmin(), AdminLayout(), links, AdminPage(), AdminCreatorsPage(), AdminPayoutsPage(), AdminTipsPage(), AdminWebhooksPage()

### Community 16 - "Tip Fee Calculations"
Cohesion: 0.19
Nodes (13): assertFeeBps(), assertSafeInteger(), BalanceSummary, BreakdownInput, calculateTipBreakdown(), estimatedPayoutFeeMinor(), LedgerProjection, PayoutLedgerMovement (+5 more)

### Community 17 - "Checkout Config & Payout Destination"
Cohesion: 0.22
Nodes (8): GET(), mocks, PayoutDestinationLookup, prepareCheckout(), SupabasePayoutDestinationRepository, Bucket, buckets, checkRateLimit()

### Community 18 - "Create Tip Use Case"
Cohesion: 0.15
Nodes (12): CreateTipInput, CreatorReference, Dependencies, inputSchema, MercadoPagoCredentialLookup, NewTip, PaymentAccountLookup, MercadoPagoRegionEnv (+4 more)

### Community 19 - "DB Migration Safety Tests"
Cohesion: 0.14
Nodes (13): creatorTotalsMigrationPath, legalAcceptanceMigrationPath, mercadoPagoAllRegionsMigrationPath, mercadoPagoMigrationPath, migration, migrationPath, operationCodeMigrationPath, payoutConflictFixPath (+5 more)

### Community 20 - "Currency & Ledger Types"
Cohesion: 0.20
Nodes (5): Currency, LedgerEntryType, tipStatuses, PayoutProviderEvent, SupabasePayoutRepository

### Community 21 - "Tip Repository & Tests"
Cohesion: 0.27
Nodes (3): legalAcceptance, TipRepository, SupabaseTipRepository

### Community 22 - "Session Refresh Proxy"
Cohesion: 0.60
Nodes (3): config, proxy(), refreshSession()

### Community 23 - "PWA Icon Conventions"
Cohesion: 0.50
Nodes (4): PWA Maskable Icon Convention, TipMe Brand Mark (TM.), Web App Manifest Icons, Maskable 512 Icon (TM.)

### Community 25 - "Google Play Icon Assets"
Cohesion: 0.67
Nodes (3): TipMe Google Play Icon (512px), Google Play Store App Listing Assets, TipMe Brand Identity (coral/red app icon, TM monogram)

## Knowledge Gaps
- **208 isolated node(s):** `nextConfig`, `name`, `version`, `private`, `dev` (+203 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createServerSupabaseClient()` connect `Auth Actions & Shell` to `Dashboard Balance UI`, `Mercado Pago OAuth Client`, `Creator QR Sharing`, `Payment Account Repository`, `Mock Payment & Capture`, `Push Notification Sender`, `Admin Panel Guard`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `Currency` connect `Currency & Ledger Types` to `Mercado Pago Payment Provider`, `Dashboard Balance UI`, `App Layout & Home`, `Mercado Pago OAuth Client`, `Mock Payment & Capture`, `Push Notification Sender`, `Mercado Pago Currency Quotes`, `Admin Panel Guard`, `Tip Fee Calculations`, `Create Tip Use Case`, `Tip Repository & Tests`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `createAdminSupabaseClient()` connect `Mock Payment & Capture` to `App Layout & Home`, `Mercado Pago OAuth Client`, `Creator QR Sharing`, `Payment Account Repository`, `Push Notification Sender`, `Mercado Pago Currency Quotes`, `Checkout Config & Payout Destination`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `createServerSupabaseClient()` (e.g. with `NotificationsPage()` and `PayoutsPage()`) actually correct?**
  _`createServerSupabaseClient()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `createAdminSupabaseClient()` (e.g. with `GET()` and `POST()`) actually correct?**
  _`createAdminSupabaseClient()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `nextConfig`, `name`, `version` to the rest of the system?**
  _213 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Mercado Pago Payment Provider` be split into smaller, more focused modules?**
  _Cohesion score 0.05143638850889193 - nodes in this community are weakly interconnected._