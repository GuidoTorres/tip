import { createHash, randomBytes } from "node:crypto";
import type { MercadoPagoRegion } from "./mercadopago-regions";

export function createMercadoPagoPkce() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createMercadoPagoAuthorizationUrl(region: MercadoPagoRegion, input: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
}) {
  const url = new URL("/authorization", region.authBaseUrl);
  url.searchParams.set("client_id", region.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}
