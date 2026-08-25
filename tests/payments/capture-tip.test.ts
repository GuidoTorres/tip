import { describe, expect, it, vi } from "vitest";
import { captureTip, type CaptureTipRepository } from "@/features/payments/capture-tip";
import type { PaymentProvider } from "@/features/payments/provider";
import { createReceiptToken } from "@/lib/security/receipt";

const secret = "receipt-secret-at-least-16";

function setup() {
  const repository: CaptureTipRepository = {
    getTarget: vi.fn().mockResolvedValue({ tipId: "tip-1", provider: "paypal", providerPaymentId: "ORDER-1", providerAccountId: "MERCHANT-1", status: "pending" }),
    attachCapture: vi.fn().mockResolvedValue(undefined),
  };
  const provider: PaymentProvider = {
    name: "paypal", createPayment: vi.fn(), getPaymentStatus: vi.fn(),
    capturePayment: vi.fn().mockResolvedValue({ status: "captured", providerCaptureId: "CAPTURE-1" }),
    verifyWebhook: vi.fn(), parseWebhook: vi.fn(), createPayout: vi.fn(), getPayoutStatus: vi.fn(),
  };
  return { repository, provider };
}

describe("captureTip", () => {
  it("stores the capture as pending without confirming financial state", async () => {
    const deps = setup();
    const result = await captureTip({ tipId: "tip-1", receiptToken: createReceiptToken("tip-1", secret) }, { ...deps, receiptSecret: secret });
    expect(result).toEqual({ status: "confirming" });
    expect(deps.repository.attachCapture).toHaveBeenCalledWith("tip-1", "CAPTURE-1", "pending");
  });

  it("rejects an invalid receipt token before contacting PayPal", async () => {
    const deps = setup();
    await expect(captureTip({ tipId: "tip-1", receiptToken: "bad" }, { ...deps, receiptSecret: secret })).rejects.toThrow("capture_not_found");
    expect(deps.provider.capturePayment).not.toHaveBeenCalled();
  });

  it("cannot capture an order owned by another provider", async () => {
    const deps = setup();
    vi.mocked(deps.repository.getTarget).mockResolvedValue({ tipId: "tip-1", provider: "mock", providerPaymentId: "ORDER-1", providerAccountId: "MERCHANT-1", status: "pending" });
    await expect(captureTip({ tipId: "tip-1", receiptToken: createReceiptToken("tip-1", secret) }, { ...deps, receiptSecret: secret })).rejects.toThrow("capture_not_found");
  });

  it("uses the platform Sandbox merchant when the creator has no connected account", async () => {
    const deps = setup();
    vi.mocked(deps.repository.getTarget).mockResolvedValue({ tipId: "tip-1", provider: "paypal", providerPaymentId: "ORDER-1", providerAccountId: null, status: "pending" });
    await captureTip(
      { tipId: "tip-1", receiptToken: createReceiptToken("tip-1", secret) },
      { ...deps, receiptSecret: secret, providerAccountOverride: "PARTNER-MERCHANT" },
    );
    expect(deps.provider.capturePayment).toHaveBeenCalledWith(expect.objectContaining({ providerAccountId: "PARTNER-MERCHANT" }));
  });
});
