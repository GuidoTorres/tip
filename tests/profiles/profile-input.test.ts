import { describe, expect, it } from "vitest";
import { parseProfileFormData } from "@/features/profiles/profile-input";

function profileForm(socialUrl?: string) {
  const form = new FormData();
  form.set("publicName", "Camila");
  form.set("username", "camila");
  form.set("bio", "Gracias por el apoyo");
  form.set("contentCategory", "livestreaming");
  form.set("creatorPolicyAccepted", "on");
  form.set("locale", "es");
  if (socialUrl !== undefined) form.set("socialUrl", socialUrl);
  return form;
}

describe("creator profile input", () => {
  it("accepts an HTTPS public social profile", () => {
    const result = parseProfileFormData(profileForm("https://www.tiktok.com/@camila"));

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.socialUrl).toBe("https://www.tiktok.com/@camila");
  });

  it("requires a public social profile", () => {
    expect(parseProfileFormData(profileForm()).success).toBe(false);
  });

  it("rejects non-web transfer protocols", () => {
    expect(parseProfileFormData(profileForm("ftp://example.com/camila")).success).toBe(false);
  });

  it("requires a supported public-content category", () => {
    const form = profileForm("https://www.tiktok.com/@camila");
    form.delete("contentCategory");

    expect(parseProfileFormData(form).success).toBe(false);
  });

  it("requires the creator to accept the content and payment rules", () => {
    const form = profileForm("https://www.tiktok.com/@camila");
    form.delete("creatorPolicyAccepted");

    expect(parseProfileFormData(form).success).toBe(false);
  });
});
