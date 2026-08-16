import { describe, expect, it } from "vitest";
import { buildPublicProfileUrl } from "@/features/profiles/public-url";
import { generatePublicProfileQr } from "@/features/profiles/qr-code";

describe("buildPublicProfileUrl", () => {
  it("elimina barras finales y añade el username", () => {
    expect(buildPublicProfileUrl("https://tipme.pro///", "camila")).toBe("https://tipme.pro/camila");
  });

  it("codifica el segmento de username", () => {
    expect(buildPublicProfileUrl("https://tipme.pro", "sofia rose")).toBe("https://tipme.pro/sofia%20rose");
  });
});

describe("generatePublicProfileQr", () => {
  it("genera un archivo PNG real como data URL", async () => {
    const dataUrl = await generatePublicProfileQr("https://tipme.pro/camila");
    const encoded = dataUrl.replace("data:image/png;base64,", "");
    const signature = Buffer.from(encoded, "base64").subarray(0, 8).toString("hex");

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(signature).toBe("89504e470d0a1a0a");
  });
});
