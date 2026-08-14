# Repeat Tip Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. No subagents and no Git operations are permitted for this workspace.

**Goal:** Add a safe path from a terminal fan receipt back to the same creator's public page.

**Architecture:** `ReceiptStatus` already receives the creator username from the server-protected receipt query. It will derive a local terminal-state action and render a normal link to `/<username>` without changing payment state or persisting fan form data.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, React server renderer.

## Global Constraints

- Confirmed copy is `Enviar otro tip`.
- Rejected copy is `Intentar nuevamente`.
- Pending and missing-username receipts render no repeat action.
- The destination is derived only from `tip.profiles.username`.
- No new dependency, database change, provider change, or Git operation.

---

### Task 1: Terminal receipt action

**Files:**
- Create: `tests/payments/receipt-status.test.tsx`
- Modify: `src/components/tips/receipt-status.tsx`

**Interfaces:**
- Consumes: `Receipt.status` and `Receipt.profiles.username` already supplied by the receipt page and status endpoint.
- Produces: a terminal-state `<a href="/<encoded username>">` action in `ReceiptStatus`.

- [ ] **Step 1: Write the failing receipt rendering test**

Use `renderToStaticMarkup` to assert:

```tsx
expect(renderReceipt("confirmed", "camila")).toContain('href="/camila"');
expect(renderReceipt("confirmed", "camila")).toContain("Enviar otro tip");
expect(renderReceipt("rejected", "camila")).toContain("Intentar nuevamente");
expect(renderReceipt("pending", "camila")).not.toContain('href="/camila"');
expect(renderReceipt("confirmed", null)).not.toContain("Enviar otro tip");
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm.cmd test -- tests/payments/receipt-status.test.tsx`

Expected: FAIL because `ReceiptStatus` does not render either repeat action.

- [ ] **Step 3: Implement the minimal terminal action**

In `ReceiptStatus`, derive the action only when `tip.profiles?.username` exists:

```tsx
const repeatLabel = confirmed ? "Enviar otro tip" : rejected ? "Intentar nuevamente" : null;
const repeatHref = tip.profiles?.username
  ? `/${encodeURIComponent(tip.profiles.username)}`
  : null;
```

Render a prominent link when both values exist. Keep Share as a secondary confirmed-only action and leave pending receipts unchanged.

- [ ] **Step 4: Verify the focused and project checks**

Run:

```powershell
npm.cmd test -- tests/payments/receipt-status.test.tsx
npm.cmd run typecheck
npm.cmd run lint
```

Expected: every command exits with code 0.
