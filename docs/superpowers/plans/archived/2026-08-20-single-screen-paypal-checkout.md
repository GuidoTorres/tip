# Single-Screen PayPal Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This project is executed locally without Git branches or commits by user request.

**Goal:** Let a fan enter tip details and card data on one screen, then create and pay the tip with one final **ENVIAR TIP** action, while keeping PayPal Wallet as a visible alternative.

**Architecture:** A rate-limited bootstrap endpoint prepares only the short-lived PayPal browser configuration; it creates no tip or PayPal order. Both CardFields and PayPal Buttons call one lazy, promise-cached `createOrder` callback that posts the current form data to the existing tip endpoint, then reuse the existing server capture, status polling, ledger, webhook, and push flow.

**Tech Stack:** Next.js 16.3 App Router route handlers, React 19 client components, TypeScript, PayPal JavaScript SDK v5 CardFields/Buttons, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-single-screen-paypal-checkout-design.md`

## Global Constraints

- Do not add dependencies.
- Do not use Git branches or commits.
- USD remains the only application currency.
- A browser callback never confirms a tip or edits a balance.
- Client Secret, PayPal access tokens, service-role keys, and persistent credentials remain server-side.
- An empty payer name becomes `payer_name = null` and `anonymous = true`; a non-empty name becomes `anonymous = false`.
- Mock payments retain their current redirect simulator.
- Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` before editing the route handler.

---

### Task 1: Prepare checkout configuration without creating an order

**Files:**
- Create: `src/features/payments/prepare-checkout.ts`
- Create: `src/app/api/payments/checkout-config/route.ts`
- Create: `tests/payments/prepare-checkout.test.ts`
- Create: `tests/payments/checkout-config-route.test.ts`
- Modify: `src/features/payments/paypal-provider.ts`
- Modify: `src/features/payments/provider.ts`

**Interfaces:**
- Produces: `CheckoutBootstrap = { kind: "redirect" } | { kind: "embedded"; checkout: EmbeddedCheckout }`.
- Produces: `PaymentProvider.prepareCheckout?(input: PrepareCheckoutInput): Promise<CheckoutPresentation | null>`.
- Consumes: `PayPalClient.generateClientToken()` and the existing PayPal configuration.

- [ ] **Step 1: Write failing provider tests**

Add tests proving that preparation returns an embedded PayPal configuration but does not call `createOrder`, and that a provider without preparation returns redirect mode:

```ts
it("prepares PayPal CardFields without creating an order", async () => {
  const client = { generateClientToken: vi.fn().mockResolvedValue("token"), createOrder: vi.fn() };
  const result = await prepareCheckout({ provider, username: "camila" }, dependencies);
  expect(result).toMatchObject({ kind: "embedded", checkout: { clientToken: "token" } });
  expect(client.createOrder).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- tests/payments/prepare-checkout.test.ts --run`

Expected: FAIL because `prepareCheckout` and the provider method do not exist.

- [ ] **Step 3: Add the provider preparation contract**

Extend `provider.ts` with:

```ts
export type PrepareCheckoutInput = { providerAccountId: string | null };
export type EmbeddedCheckout = Extract<CheckoutPresentation, { kind: "embedded" }>;

export interface PaymentProvider {
  prepareCheckout?(input: PrepareCheckoutInput): Promise<EmbeddedCheckout | null>;
}

export type PaymentResult = {
  providerPaymentId: string;
  status: Extract<TipStatus, "pending" | "confirmed" | "rejected">;
  checkout?: CheckoutPresentation;
  gatewayFeeMinor: number | null;
};
```

Add the optional method to the current `PaymentProvider` interface without changing its existing required methods.

In `PayPalPaymentProvider.prepareCheckout`, generate the short-lived client token and return the public SDK fields currently placed in `createPayment`. Change PayPal `createPayment` to create only the order and omit `checkout`, avoiding a second client-token API request during the final click. Mock continues returning its redirect checkout.

- [ ] **Step 4: Implement `prepareCheckout` service**

Define:

```ts
export type CheckoutBootstrap =
  | { kind: "redirect" }
  | { kind: "embedded"; checkout: EmbeddedCheckout };

export async function prepareCheckout(
  input: { username: string },
  dependencies: {
    provider: PaymentProvider;
    creators: TipRepository;
    paymentAccounts?: PaymentAccountLookup;
    payoutDestinations?: PayoutDestinationLookup;
    providerAccountOverride?: string;
    paypalFlow?: PayPalFlow;
  },
): Promise<CheckoutBootstrap>;
```

Validate the username and resolve the creator. For `platform_payouts`, require the same configured payout destination as `createTip`; for multiparty, resolve the connected merchant or configured override. Then call `provider.prepareCheckout`. Return `{ kind: "redirect" }` for mock or providers without embedded preparation. Do not insert a tip.

- [ ] **Step 5: Run the provider test and verify GREEN**

Run: `npm.cmd test -- tests/payments/prepare-checkout.test.ts --run`

Expected: PASS.

- [ ] **Step 6: Write the failing route tests**

Cover successful embedded configuration, mock redirect configuration, invalid usernames, and rate limiting. Assert that responses never contain `clientSecret`, `accessToken`, or service-role values.

- [ ] **Step 7: Implement the route handler**

Create `GET /api/payments/checkout-config?username=camila`. Use `getServerEnv`, `getPaymentProviderFromEnv`, admin repositories, and `checkRateLimit` with a key such as `checkout-config:${ip}`. Return `400` for an invalid username, `404` for a missing/unavailable creator destination, `429` for rate limiting, and `503` for a provider failure.

- [ ] **Step 8: Run Task 1 tests**

Run: `npm.cmd test -- tests/payments/prepare-checkout.test.ts tests/payments/checkout-config-route.test.ts --run`

Expected: PASS.

---

### Task 2: Make PayPal create the order lazily and reuse one attempt

**Files:**
- Create: `src/features/payments/checkout-attempt.ts`
- Create: `tests/payments/checkout-attempt.test.ts`
- Modify: `src/components/payments/paypal-checkout.tsx`
- Modify: `tests/payments/paypal-checkout.test.tsx`

**Interfaces:**
- Produces: `CreatedCheckoutAttempt = { tipId: string; orderId: string; receiptToken: string }`.
- Produces: `createCheckoutAttempt(factory)` with `getOrCreate()` and `clear()`.
- Consumes: `createOrder(): Promise<CreatedCheckoutAttempt>` passed by `TipForm`.

- [ ] **Step 1: Write the failing concurrency test**

```ts
it("reuses one in-flight order for concurrent PayPal callbacks", async () => {
  const factory = vi.fn().mockResolvedValue({ tipId: "tip-1", orderId: "ORDER-1", receiptToken: "token" });
  const attempt = createCheckoutAttempt(factory);
  const [first, second] = await Promise.all([attempt.getOrCreate(), attempt.getOrCreate()]);
  expect(first).toEqual(second);
  expect(factory).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the attempt test and verify RED**

Run: `npm.cmd test -- tests/payments/checkout-attempt.test.ts --run`

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement the minimal attempt controller**

Cache the promise before awaiting it. Clear the cache only when the factory rejects before returning an order; expose `clear()` for a terminal rejected order.

- [ ] **Step 4: Run the attempt test and verify GREEN**

Run: `npm.cmd test -- tests/payments/checkout-attempt.test.ts --run`

Expected: PASS.

- [ ] **Step 5: Rewrite checkout component expectations first**

Update `paypal-checkout.test.tsx` to expect:

```ts
expect(html).toContain("paypal-card-number");
expect(html).toContain("ENVIAR TIP");
expect(html).toContain("O paga con");
expect(html).toContain("paypal-button-container");
expect(html).not.toContain('aria-hidden="true"');
```

Also assert that “Pago confirmado” is absent.

- [ ] **Step 6: Run the component test and verify RED**

Run: `npm.cmd test -- tests/payments/paypal-checkout.test.tsx --run`

Expected: FAIL because the wallet is hidden and the component requires a pre-created order.

- [ ] **Step 7: Refactor `PayPalCheckout`**

Use props:

```ts
type PayPalCheckoutProps = {
  checkout: EmbeddedCheckout;
  locale: Locale;
  createOrder: () => Promise<CreatedCheckoutAttempt>;
};
```

Initialize CardFields and Buttons immediately. Both SDK `createOrder` callbacks call `attempt.getOrCreate()` and return `orderId`. `onApprove` obtains the cached attempt, calls the existing capture endpoint with `tipId` and `receiptToken`, polls the protected status endpoint, and routes to the receipt. If confirmation remains pending after the bounded poll, route to the pending receipt so its existing polling continues. Render the CardFields submit button as **ENVIAR TIP**, followed by “O paga con” and the eligible PayPal container. Hide only an ineligible payment method, not the entire wallet when cards are eligible.

- [ ] **Step 8: Run Task 2 tests**

Run: `npm.cmd test -- tests/payments/checkout-attempt.test.ts tests/payments/paypal-checkout.test.tsx --run`

Expected: PASS.

---

### Task 3: Compose the fan form and payment into one screen

**Files:**
- Modify: `src/components/tips/tip-form.tsx`
- Modify: `tests/ui/fan-tip-amounts.test.tsx`
- Modify: `tests/ui/fan-legal-consent.test.tsx`
- Create: `tests/ui/fan-single-screen-checkout.test.tsx`

**Interfaces:**
- Consumes: `GET /api/payments/checkout-config?username={encodedUsername}`.
- Consumes: `PayPalCheckout.createOrder(): Promise<CreatedCheckoutAttempt>`.
- Produces: normalized `/api/tips` payload with `anonymous: payerName.trim() === ""`.

- [ ] **Step 1: Write failing fan-form tests**

Assert the initial form has no text or control for “Enviar anónimamente”, contains `payerName`, uses a compact message class such as `min-h-16`, retains the legal checkbox, and does not render the old preliminary action when embedded PayPal is active.

- [ ] **Step 2: Run fan-form tests and verify RED**

Run: `npm.cmd test -- tests/ui/fan-tip-amounts.test.tsx tests/ui/fan-legal-consent.test.tsx tests/ui/fan-single-screen-checkout.test.tsx --run`

Expected: FAIL because the anonymous selector and old preliminary button still exist.

- [ ] **Step 3: Separate payload construction from payment submission**

Keep a form ref and implement a callback that:

```ts
if (!formRef.current?.reportValidity()) throw new Error("invalid_tip_form");
const payerName = String(formData.get("payerName") ?? "").trim();
const payload = {
  username,
  amountMinor: finalAmount,
  payerName: payerName || null,
  anonymous: payerName === "",
  message: String(formData.get("message") ?? ""),
  legalAccepted,
  coverProcessing,
  legalTermsVersion: CURRENT_LEGAL_TERMS_VERSION,
};
```

Post the payload to `/api/tips`, verify `checkout.kind === "embedded"`, and return `{ tipId, orderId: providerPaymentId, receiptToken }`. Do not treat that response as payment confirmation.

- [ ] **Step 4: Load checkout bootstrap without creating a tip**

On mount, fetch the checkout-config route. For `embedded`, render `PayPalCheckout` inside the same form after legal consent. For `redirect`, retain the existing mock submit action. Add compact loading, retry, and provider-error states. Abort or ignore the fetch after unmount.

- [ ] **Step 5: Apply the requested UI changes**

Always render the optional name input. Remove `anonymous` React state, `LockSimple`, and the anonymous checkbox. Change the message textarea from `min-h-24` to `min-h-16` and set `rows={2}`. Ensure only the final CardFields action says **ENVIAR TIP** in PayPal mode.

- [ ] **Step 6: Run Task 3 tests**

Run: `npm.cmd test -- tests/ui/fan-tip-amounts.test.tsx tests/ui/fan-legal-consent.test.tsx tests/ui/fan-single-screen-checkout.test.tsx tests/payments/paypal-checkout.test.tsx --run`

Expected: PASS.

---

### Task 4: Harden normalization and preserve provider behavior

**Files:**
- Modify: `src/features/payments/create-tip.ts`
- Modify: `tests/payments/create-tip.test.ts`
- Modify: `tests/payments/mock-provider.test.ts`

**Interfaces:**
- Consumes: existing `CreateTipInput`.
- Produces: canonical anonymity derived server-side from the trimmed payer name.

- [ ] **Step 1: Write failing server-normalization tests**

Add cases proving that `{ payerName: "", anonymous: false }` cannot expose an empty identity and that a non-empty name is stored non-anonymously. The expected inserted values are:

```ts
expect(repository.insertTip).toHaveBeenCalledWith(expect.objectContaining({
  payerName: null,
  anonymous: true,
}));
```

- [ ] **Step 2: Run the normalization test and verify RED**

Run: `npm.cmd test -- tests/payments/create-tip.test.ts --run`

Expected: FAIL because the server currently trusts the browser's `anonymous` boolean.

- [ ] **Step 3: Normalize anonymity server-side**

After Zod trims the name, derive:

```ts
const payerName = value.payerName || null;
const anonymous = payerName === null;
```

Use these derived values for `insertTip`, regardless of the submitted boolean. Retain the boolean in the input schema temporarily for backward compatibility with deployed clients and mock tests.

- [ ] **Step 4: Run payment-domain regression tests**

Run: `npm.cmd test -- tests/payments/create-tip.test.ts tests/payments/mock-provider.test.ts tests/payments/process-webhook.test.ts tests/notifications/push.test.ts --run`

Expected: PASS, including anonymous push privacy and mock redirection.

---

### Task 5: Verify the complete delivery

**Files:**
- Modify if behavior changed materially: `README.md`

**Interfaces:**
- Consumes all prior task outputs.
- Produces a production-buildable checkout and verification evidence.

- [ ] **Step 1: Run focused checkout tests**

Run: `npm.cmd test -- tests/payments/prepare-checkout.test.ts tests/payments/checkout-config-route.test.ts tests/payments/checkout-attempt.test.ts tests/payments/paypal-checkout.test.tsx tests/ui/fan-single-screen-checkout.test.tsx tests/payments/create-tip.test.ts --run`

Expected: all listed tests PASS.

- [ ] **Step 2: Run static verification**

Run: `npm.cmd run typecheck`

Expected: exit code 0.

Run: `npm.cmd run lint`

Expected: exit code 0.

- [ ] **Step 3: Run the complete suite**

Run: `npm.cmd test -- --run`

Expected: all test files and tests PASS with exit code 0.

- [ ] **Step 4: Run the production build**

Run: `npm.cmd run build`

Expected: exit code 0 and `/api/payments/checkout-config` listed as a dynamic route.

- [ ] **Step 5: Report the manual Sandbox check**

The user performs the only required external-device check:

1. open `tipme.pro/<username>` or the Vercel preview;
2. confirm card fields appear on the initial fan screen;
3. leave name empty and pay with a Sandbox card using one **ENVIAR TIP** click;
4. verify receipt, operation code, creator balance, and push;
5. repeat with the PayPal Wallet button and a named tip;
6. verify only one tip exists for each attempt.
