import { describe, expect, it } from "vitest";
import {
  createPaymentTimingRecorder,
  paymentTimingDebugEnabled,
  paymentTimingReceiptHref,
  parseStoredPaymentTimings,
} from "@/features/payments/payment-timing";

describe("payment timing recorder", () => {
  it("records a pending stage and completes it with elapsed milliseconds", () => {
    let now = 1_000;
    const snapshots: Array<Array<{ stage: string; status: string; durationMs: number | null }>> = [];
    const recorder = createPaymentTimingRecorder({
      enabled: true,
      now: () => now,
      onChange: (entries) => snapshots.push(entries),
    });

    const finish = recorder.start("paypal_sdk_load");
    expect(snapshots.at(-1)).toEqual([{ stage: "paypal_sdk_load", status: "pending", durationMs: null }]);

    now = 2_275.4;
    finish("completed");
    expect(snapshots.at(-1)).toEqual([{ stage: "paypal_sdk_load", status: "completed", durationMs: 1_275 }]);
  });

  it("does not collect diagnostics when the mode is disabled", () => {
    const snapshots: unknown[] = [];
    const recorder = createPaymentTimingRecorder({ enabled: false, now: () => 100, onChange: (entries) => snapshots.push(entries) });

    recorder.start("checkout_bootstrap")("completed");
    recorder.record("capture", 450, "completed");

    expect(snapshots).toEqual([]);
    expect(recorder.entries()).toEqual([]);
  });

  it("marks a measured rejection as failed and preserves its duration", async () => {
    let now = 20;
    const recorder = createPaymentTimingRecorder({ enabled: true, now: () => now });

    await expect(recorder.measure("capture", async () => {
      now = 345;
      throw new Error("capture_failed");
    })).rejects.toThrow("capture_failed");

    expect(recorder.entries()).toEqual([{ stage: "capture", status: "failed", durationMs: 325 }]);
  });

  it("enables diagnostics only for the explicit debug query value", () => {
    expect(paymentTimingDebugEnabled("?debugPayments=1")).toBe(true);
    expect(paymentTimingDebugEnabled("?debugPayments=0")).toBe(false);
    expect(paymentTimingDebugEnabled("?other=1")).toBe(false);
  });

  it("keeps diagnostics enabled when navigating to the receipt", () => {
    const receipt = "/tips/tip-1/receipt?token=receipt-token";
    expect(paymentTimingReceiptHref(receipt, true)).toBe(`${receipt}&debugPayments=1`);
    expect(paymentTimingReceiptHref(receipt, false)).toBe(receipt);
  });

  it("ignores malformed or unknown stored diagnostic entries", () => {
    expect(parseStoredPaymentTimings(JSON.stringify([
      { stage: "paypal_sdk_load", status: "completed", durationMs: 320 },
      { stage: "secret_stage", status: "completed", durationMs: 999 },
      { stage: "capture", status: "completed", durationMs: -1 },
    ]))).toEqual([{ stage: "paypal_sdk_load", status: "completed", durationMs: 320 }]);
    expect(parseStoredPaymentTimings("not-json")).toEqual([]);
  });

  it("continues an existing trace when the checkout reinitializes", () => {
    const recorder = createPaymentTimingRecorder({
      enabled: true,
      now: () => 1_000,
      initialEntries: [{ stage: "checkout_bootstrap", status: "completed", durationMs: 210 }],
    });

    recorder.record("paypal_sdk_load", 340);

    expect(recorder.entries()).toEqual([
      { stage: "checkout_bootstrap", status: "completed", durationMs: 210 },
      { stage: "paypal_sdk_load", status: "completed", durationMs: 340 },
    ]);
  });
});
