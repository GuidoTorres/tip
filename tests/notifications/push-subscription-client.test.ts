import { describe, expect, it } from "vitest";
import {
  persistPushSubscription,
  syncExistingPushSubscription,
} from "@/features/notifications/push-subscription-client";

const subscriptionJson = {
  endpoint: "https://push.example/subscription-1",
  expirationTime: null,
  keys: { p256dh: "public-key", auth: "auth-secret" },
};

const subscription: PushSubscription = {
  endpoint: subscriptionJson.endpoint,
  expirationTime: null,
  options: { applicationServerKey: null, userVisibleOnly: true },
  getKey: () => null,
  toJSON: () => subscriptionJson,
  unsubscribe: async () => true,
};

describe("push subscription synchronization", () => {
  it("persists an existing browser subscription before reporting it as active", async () => {
    const persisted: PushSubscription[] = [];

    const state = await syncExistingPushSubscription(
      async () => subscription,
      async (value) => { persisted.push(value); },
    );

    expect(state).toBe("active");
    expect(persisted).toEqual([subscription]);
  });

  it("reports ready when the browser has no subscription", async () => {
    const persisted: PushSubscription[] = [];

    const state = await syncExistingPushSubscription(
      async () => null,
      async (value) => { persisted.push(value); },
    );

    expect(state).toBe("ready");
    expect(persisted).toEqual([]);
  });

  it("sends the complete subscription to the authenticated backend endpoint", async () => {
    let request: { input: RequestInfo | URL; init?: RequestInit } | undefined;

    await persistPushSubscription(subscription, async (input, init) => {
      request = { input, init };
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    expect(request).toEqual({
      input: "/api/push/subscriptions",
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscriptionJson),
      },
    });
  });

  it("does not report success when the backend rejects the subscription", async () => {
    await expect(persistPushSubscription(subscription, async () => (
      new Response(JSON.stringify({ error: "subscription_failed" }), { status: 500 })
    ))).rejects.toThrow("subscription_failed");
  });
});
