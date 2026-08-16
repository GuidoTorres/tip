export function buildPublicProfileUrl(appUrl: string, username: string): string {
  return `${appUrl.replace(/\/+$/, "")}/${encodeURIComponent(username)}`;
}
