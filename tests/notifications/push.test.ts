import { describe, expect, it } from "vitest";
import { buildTipPushPayload, sendCreatorPush, type PushSender } from "@/features/notifications/push";

describe("buildTipPushPayload", () => {
  it("nunca filtra nombre en un tip anónimo", () => {
    const payload = buildTipPushPayload({ id: "tip-1", amountMinor: 2_000, currency: "USD", payerName: "Nombre secreto", message: "Mensaje", anonymous: true, locale: "es" });
    expect(payload.body).toContain("Alguien");
    expect(JSON.stringify(payload)).not.toContain("Nombre secreto");
  });

  it("incluye nombre y un mensaje corto cuando no es anónimo", () => {
    const payload = buildTipPushPayload({ id: "tip-1", amountMinor: 2_000, currency: "USD", payerName: "Mateo", message: "x".repeat(100), anonymous: false, locale: "es" });
    expect(payload.body).toContain("Mateo");
    expect(payload.body.length).toBeLessThanOrEqual(140);
    expect(payload.url).toBe("/dashboard/tips/tip-1");
  });
});

describe("sendCreatorPush", () => {
  it("envía a múltiples dispositivos y revoca endpoints expirados", async () => {
    const sent: string[] = []; const revoked: string[] = [];
    const sender: PushSender = { send: async (subscription) => { sent.push(subscription.endpoint); if (subscription.endpoint === "expired") throw Object.assign(new Error("gone"), { statusCode: 410 }); } };
    const summary = await sendCreatorPush(
      { title: "Nuevo tip", body: "Alguien te envió un tip", url: "/dashboard", tag: "tip-1" },
      [{ id: "1", endpoint: "phone", p256dh: "a", auth: "b" }, { id: "2", endpoint: "laptop", p256dh: "c", auth: "d" }, { id: "3", endpoint: "expired", p256dh: "e", auth: "f" }],
      sender,
      { revoke: async (id) => { revoked.push(id); }, markUsed: async () => undefined },
    );
    expect(sent).toEqual(["phone", "laptop", "expired"]);
    expect(revoked).toEqual(["3"]);
    expect(summary).toEqual({ sent: 2, revoked: 1, failed: 0 });
  });
});
