# Repeat Tip Action Design

## Goal

Let a fan return to the same creator's public profile after reaching a terminal payment receipt, without losing access to the receipt or accidentally sending another payment.

## Behavior

- A confirmed receipt shows a prominent `Enviar otro tip` action.
- A rejected receipt shows a prominent `Intentar nuevamente` action.
- Both actions link to `/<creator_username>` using the username loaded server-side with the receipt.
- Pending receipts do not show a repeat-payment action.
- The existing share action remains secondary on confirmed receipts.
- Name, message, amount, and anonymity are not copied into a new tip attempt.
- If the receipt has no creator username, the repeat action is omitted safely.

## Implementation boundary

The change belongs in `ReceiptStatus`. It reuses the creator profile already returned by the protected receipt query and does not change the payment provider, webhook, ledger, database, or public tip form.

## Error and security handling

The destination is built only from the server-loaded profile username. The receipt token remains required to view the receipt, and returning to the public profile does not grant access to private payment data.

## Verification

Add focused component-level coverage for confirmed, rejected, pending, and missing-username states. Then run the focused test, typecheck, and lint.
