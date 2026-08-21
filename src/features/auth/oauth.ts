const DEFAULT_AUTH_DESTINATION = "/dashboard";

export function sanitizeInternalPath(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return DEFAULT_AUTH_DESTINATION;
  return value;
}

export function getOAuthDestination({
  onboardingCompleted,
  requestedNext,
}: {
  onboardingCompleted: boolean;
  requestedNext: string | null | undefined;
}): string {
  if (!onboardingCompleted) return "/onboarding";
  const destination = sanitizeInternalPath(requestedNext);
  return destination === "/onboarding" ? DEFAULT_AUTH_DESTINATION : destination;
}
