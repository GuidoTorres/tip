export type PayPalMerchantIntegration = {
  merchant_id?: string;
  tracking_id?: string;
  payments_receivable?: boolean;
  primary_email_confirmed?: boolean;
  products?: Array<{ name?: string; status?: string; vetting_status?: string }>;
  capabilities?: Array<{ name?: string; status?: string }>;
  oauth_integrations?: Array<{ oauth_third_party?: Array<{ scopes?: string[] }> }>;
};

export interface PayPalOnboardingClient {
  createPartnerReferral(payload: unknown): Promise<{ links?: Array<{ href: string; rel: string }> }>;
  getMerchantIntegration(merchantId: string): Promise<PayPalMerchantIntegration>;
  getMerchantIntegrationByTrackingId(trackingId: string): Promise<PayPalMerchantIntegration>;
}

export type PayPalAccountWrite = {
  creatorId: string;
  providerMerchantId: string;
  status: "connected" | "restricted";
  onboardingCompleted: boolean;
  emailConfirmed: boolean;
  paymentsReceivable: boolean;
  cardPaymentsEnabled: boolean;
};

export interface PaymentAccountWriter {
  upsertPayPal(account: PayPalAccountWrite): Promise<void>;
}

export async function startPayPalOnboarding(input: { creatorId: string; returnUrl: string }, client: PayPalOnboardingClient) {
  const result = await client.createPartnerReferral({
    tracking_id: input.creatorId,
    operations: [{ operation: "API_INTEGRATION", api_integration_preference: { rest_api_integration: {
      integration_method: "PAYPAL", integration_type: "THIRD_PARTY",
      third_party_details: { features: ["PAYMENT", "REFUND", "PARTNER_FEE"] },
    } } }],
    products: ["PPCP"],
    legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
    partner_config_override: { return_url: input.returnUrl, return_url_description: "Volver a TipMe" },
  });
  const action = result.links?.find((link) => link.rel === "action_url")?.href;
  if (!action) throw new Error("paypal_onboarding_url_missing");
  return action;
}

export async function completePayPalOnboarding(
  input: { creatorId: string; merchantId: string },
  dependencies: { client: PayPalOnboardingClient; repository: PaymentAccountWriter },
) {
  const integration = await dependencies.client.getMerchantIntegration(input.merchantId);
  return savePayPalOnboardingIntegration(input, integration, dependencies.repository);
}

export async function refreshPayPalOnboarding(
  input: { creatorId: string },
  dependencies: { client: PayPalOnboardingClient; repository: PaymentAccountWriter },
) {
  const integration = await dependencies.client.getMerchantIntegrationByTrackingId(input.creatorId);
  if (!integration.merchant_id) return { status: "pending" as const };
  if (integration.tracking_id && integration.tracking_id !== input.creatorId) throw new Error("paypal_tracking_mismatch");
  return completePayPalOnboarding(
    { creatorId: input.creatorId, merchantId: integration.merchant_id },
    dependencies,
  );
}

async function savePayPalOnboardingIntegration(
  input: { creatorId: string; merchantId: string },
  integration: PayPalMerchantIntegration,
  repository: PaymentAccountWriter,
) {
  if (integration.merchant_id && integration.merchant_id !== input.merchantId) throw new Error("paypal_merchant_mismatch");
  const emailConfirmed = integration.primary_email_confirmed === true;
  const paymentsReceivable = integration.payments_receivable === true;
  const hasOauth = integration.oauth_integrations?.some((item) => item.oauth_third_party?.some((grant) => (grant.scopes?.length ?? 0) > 0)) === true;
  const productReady = integration.products?.some((product) => product.name?.startsWith("PPCP") &&
    (product.vetting_status === "SUBSCRIBED" || product.vetting_status === "APPROVED" || product.status === "ACTIVE")) === true;
  const cardPaymentsEnabled = integration.capabilities?.some((capability) => capability.name === "CUSTOM_CARD_PROCESSING" && capability.status === "ACTIVE") === true;
  const onboardingCompleted = emailConfirmed && paymentsReceivable && hasOauth && productReady;
  const status = onboardingCompleted ? "connected" as const : "restricted" as const;
  await repository.upsertPayPal({ creatorId: input.creatorId, providerMerchantId: input.merchantId, status,
    onboardingCompleted, emailConfirmed, paymentsReceivable, cardPaymentsEnabled });
  return { status, cardPaymentsEnabled };
}
