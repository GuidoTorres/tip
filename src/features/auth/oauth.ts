const DEFAULT_AUTH_DESTINATION = "/dashboard";

export function getGoogleCallbackUrl(appUrl: string) {
  return `${appUrl.replace(/\/$/, "")}/auth/callback`;
}

export function getMisroutedOAuthCallback(code: string | undefined) {
  if (!code || !/^[A-Za-z0-9._~-]{20,512}$/.test(code)) return null;
  return `/auth/callback?code=${encodeURIComponent(code)}`;
}

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
