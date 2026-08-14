import { describe, expect, it } from "vitest";
import { validateUsername } from "@/features/profiles/username";

describe("validateUsername", () => {
  it.each(["camila", "valentina23", "sofia_rose"])("acepta %s", (username) => {
    expect(validateUsername(username)).toEqual({ ok: true, value: username });
  });

  it("normaliza mayúsculas antes de validar disponibilidad", () => {
    expect(validateUsername("Camila")).toEqual({ ok: true, value: "camila" });
  });

  it.each(["_camila", "camila_", "camila__rose", "ca", "admin", "dashboard", "api", "auth", "camila-roja"])('rechaza "%s"', (username) => {
    expect(validateUsername(username).ok).toBe(false);
  });
});

