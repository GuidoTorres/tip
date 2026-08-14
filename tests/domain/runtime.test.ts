import { describe, expect, it } from "vitest";
import { mockSimulatorAllowed } from "@/lib/env/runtime";

describe("mockSimulatorAllowed", () => {
  it("bloquea siempre el entorno Production de Vercel", () => {
    expect(mockSimulatorAllowed({ NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(false);
  });

  it("habilita desarrollo local y Vercel Preview", () => {
    expect(mockSimulatorAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(mockSimulatorAllowed({ NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe(true);
  });
});
