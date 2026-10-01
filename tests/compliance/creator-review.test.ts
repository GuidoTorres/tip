import { describe, expect, it, vi } from "vitest";
import { reviewCreatorPolicy } from "@/features/compliance/creator-review";

describe("creator policy review", () => {
  it("writes the decision through the audited database operation", async () => {
    const repository = { review: vi.fn().mockResolvedValue(undefined) };

    await reviewCreatorPolicy({ creatorId: "7d9554d4-7e1b-42e5-9d16-f0030ab6008e", status: "approved", reason: "Perfil pÃºblico verificado" }, {
      adminId: "8a05c612-4138-46d1-8f63-607fcde5fc88",
      repository,
    });

    expect(repository.review).toHaveBeenCalledWith({
      creatorId: "7d9554d4-7e1b-42e5-9d16-f0030ab6008e",
      adminId: "8a05c612-4138-46d1-8f63-607fcde5fc88",
      status: "approved",
      reason: "Perfil pÃºblico verificado",
    });
  });

  it("rejects unsupported decisions before touching the repository", async () => {
    const repository = { review: vi.fn() };

    await expect(reviewCreatorPolicy({ creatorId: "7d9554d4-7e1b-42e5-9d16-f0030ab6008e", status: "approved_by_creator", reason: "x" }, {
      adminId: "8a05c612-4138-46d1-8f63-607fcde5fc88",
      repository,
    })).rejects.toThrow("invalid_creator_review");

    expect(repository.review).not.toHaveBeenCalled();
  });
});
