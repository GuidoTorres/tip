type PushSubscriptionState = "active" | "ready";

export async function persistPushSubscription(
  subscription: Pick<PushSubscription, "toJSON">,
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl("/api/push/subscriptions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!response.ok) throw new Error("subscription_failed");
}

export async function syncExistingPushSubscription(
  getSubscription: () => Promise<PushSubscription | null>,
  persist: (subscription: PushSubscription) => Promise<void> = persistPushSubscription,
): Promise<PushSubscriptionState> {
  const subscription = await getSubscription();
  if (!subscription) return "ready";

  await persist(subscription);
  return "active";
}
