import { describe, expect, it, vi } from "vitest";
import { logSupabaseError } from "@/lib/logging/supabase-error";

describe("logSupabaseError", () => {
  it("logs only the diagnostic fields explicitly allowed by TipMe", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logSupabaseError(
      "saveOnboardingProfile",
      {
        code: "42501",
        message: "new row violates row-level security policy",
        details: "diagnostic detail",
        hint: "diagnostic hint",
        accessToken: "must-not-be-logged",
      },
      "creator-id",
    );

    expect(errorSpy).toHaveBeenCalledWith("[TipMe] Supabase operation failed", {
      context: "saveOnboardingProfile",
      userId: "creator-id",
      code: "42501",
      message: "new row violates row-level security policy",
      details: "diagnostic detail",
      hint: "diagnostic hint",
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("must-not-be-logged");

    errorSpy.mockRestore();
  });
});
