# Mercado Pago Regional Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir pagos directos a creadores de México y Colombia mediante Mercado Pago Split Payments 1:1, con 1% para TipMe y confirmación webhook que conserva ledger y push.

**Architecture:** `PAYMENT_PROVIDER=mercadopago` activa OAuth regional, Card Payment Brick y un adapter de Payments API. Los tokens del vendedor quedan cifrados en una tabla privada; cada pago usa el token OAuth del creador y `application_fee`. El navegador solo tokeniza/presenta y el webhook firmado es la única fuente de confirmación.

**Tech Stack:** Next.js 16.3 App Router, TypeScript, `mercadopago`, `@mercadopago/sdk-react`, Supabase/PostgreSQL/RLS, Vitest, Web Push.

**Spec:** `docs/superpowers/specs/2026-08-20-mercadopago-regional-split-design.md`

## Global Constraints

- Sin Git, ramas ni commits.
- Mantener mock y PayPal compilando.
- México usa MXN; Colombia usa COP; importes internos enteros.
- `PLATFORM_FEE_BPS=100`, nunca hardcodeado en el adapter.
- El frontend no confirma dinero.
- Secretos y tokens OAuth solo server-side y cifrados.
- Pruebas focalizadas antes de build completo.

---

### Task 1: Configuración y seguridad de credenciales

**Files:**
- Modify: `package.json`, `package-lock.json`, `.env.example`
- Modify: `src/lib/env/server.ts`
- Modify: `src/features/payments/types.ts`
- Create: `src/features/payments/mercadopago-regions.ts`
- Create: `src/lib/security/token-encryption.ts`
- Test: `tests/payments/mercadopago-regions.test.ts`
- Test: `tests/security/token-encryption.test.ts`

- [ ] Escribir tests que esperan MX→MXN, CO→COP, URLs regionales, rechazo de país desconocido y cifrado autenticado que falla al manipular ciphertext.
- [ ] Ejecutar los tests y comprobar RED.
- [ ] Instalar `mercadopago` y `@mercadopago/sdk-react`.
- [ ] Añadir `mercadopago` al enum del proveedor, MXN a monedas y variables regionales más `PAYMENT_TOKEN_ENCRYPTION_KEY`.
- [ ] Implementar AES-256-GCM con clave base64 de 32 bytes, IV aleatorio de 12 bytes y formato versionado `v1.iv.tag.ciphertext`.
- [ ] Ejecutar tests focalizados y comprobar PASS.

### Task 2: Migración y repositorio OAuth privado

**Files:**
- Create: `supabase/migrations/202608200005_mercadopago_regional_accounts.sql`
- Modify: `src/features/payments/payment-account-repository.ts`
- Create: `src/features/payments/mercadopago-credential-repository.ts`
- Test: `tests/database/migration-safety.test.ts`
- Test: `tests/payments/mercadopago-credential-repository.test.ts`

- [ ] Escribir tests para provider `mercadopago`, ownership, token no visible a authenticated y upsert/find por creador.
- [ ] Ejecutar RED.
- [ ] Añadir MXN al enum PostgreSQL, ampliar check de provider y columnas `provider_country`/`provider_currency`.
- [ ] Crear `payment_account_credentials` con PK/FK a payment account, ciphertexts, expiry, RLS sin acceso anon/authenticated y grants service_role.
- [ ] Implementar repositorio que cifra al guardar y descifra solo en DAL server-only.
- [ ] Ejecutar PASS.

### Task 3: OAuth regional con PKCE

**Files:**
- Create: `src/features/payments/mercadopago-client.ts`
- Create: `src/features/payments/mercadopago-oauth.ts`
- Create: `src/app/api/mercadopago/oauth/start/route.ts`
- Create: `src/app/api/mercadopago/oauth/callback/route.ts`
- Create: `src/components/payments/mercadopago-connect.tsx`
- Modify: `src/app/onboarding/page.tsx`
- Modify: `src/features/profiles/actions.ts`
- Test: `tests/payments/mercadopago-oauth.test.ts`
- Test: `tests/payments/mercadopago-oauth-routes.test.ts`

- [ ] Escribir tests de state, PKCE S256, callback expirado, país manipulado, usuario no autenticado y persistencia del `user_id` verificado por `/users/me`.
- [ ] Ejecutar RED.
- [ ] Implementar cliente fetch estrecho para `/oauth/token`, refresh y `/users/me`; no loguear cuerpos sensibles.
- [ ] Implementar rutas POST/GET con cookies HttpOnly de diez minutos y URLs derivadas de `NEXT_PUBLIC_APP_URL`.
- [ ] Mostrar selector México/Colombia y botón Conectar; completar onboarding solo con cuenta connected cuando el provider sea Mercado Pago.
- [ ] Ejecutar PASS.

### Task 4: Adapter de pago Split 1:1

**Files:**
- Modify: `src/features/payments/provider.ts`
- Modify: `src/features/payments/provider-factory.ts`
- Create: `src/features/payments/mercadopago-provider.ts`
- Modify: `src/features/payments/create-tip.ts`
- Modify: `src/app/api/tips/route.ts`
- Test: `tests/payments/mercadopago-provider.test.ts`
- Test: `tests/payments/create-tip.test.ts`

- [ ] Escribir tests literales para un tip MXN 200.00: `transaction_amount: 200`, `application_fee: 2`, token OAuth del vendedor, idempotency, notification URL y `external_reference=tipId`.
- [ ] Ejecutar RED.
- [ ] Añadir un `MercadoPagoCardPaymentData` validado al input server-side y credential/contexto genérico solo servidor al provider.
- [ ] Implementar POST `/v1/payments`; retornar siempre tip `pending` y provider payment id, aun si la respuesta inmediata es approved.
- [ ] Usar moneda de la cuenta conectada, no `APPLICATION_CURRENCY`, cuando provider sea Mercado Pago.
- [ ] Ejecutar PASS.

### Task 5: Card Payment Brick en la página del fan

**Files:**
- Create: `src/components/payments/mercadopago-card-checkout.tsx`
- Modify: `src/components/tips/tip-form.tsx`
- Modify: `src/app/[username]/page.tsx`
- Modify: `src/features/payments/prepare-checkout.ts`
- Modify: `src/app/api/payments/checkout-config/route.ts`
- Test: `tests/payments/mercadopago-card-checkout.test.tsx`
- Test: `tests/ui/fan-single-screen-checkout.test.tsx`

- [ ] Escribir tests de monto/moneda/public key regional, un solo POST al pagar, bloqueo durante envío y navegación a comprobante pendiente.
- [ ] Ejecutar RED.
- [ ] Hacer bootstrap público seguro `{kind:'mercadopago', publicKey, country, currency}` solo si la cuenta está connected.
- [ ] Inicializar SDK y renderizar `CardPayment`; fusionar su formData con nombre/mensaje/consentimiento y enviar a `/api/tips`.
- [ ] No mostrar un segundo botón propio cuando el Brick ya muestra Pagar.
- [ ] Ejecutar PASS.

### Task 6: Webhook firmado y consulta autoritativa

**Files:**
- Create: `src/features/payments/mercadopago-webhook.ts`
- Create: `src/features/payments/mercadopago-webhook-handler.ts`
- Create: `src/app/api/webhooks/mercadopago/[country]/route.ts`
- Modify: `src/features/payments/supabase-webhook-repository.ts`
- Test: `tests/payments/mercadopago-webhook.test.ts`
- Test: `tests/payments/process-mercadopago-webhook.test.ts`

- [ ] Escribir tests de firma válida/alterada, payment approved/pending/rejected/refunded/charged_back, mismatch de creator/currency/amount/fee y evento duplicado.
- [ ] Ejecutar RED.
- [ ] Validar firma con `WebhookSignatureValidator`, cargar Payment por id usando credencial del seller y cruzar todos los campos con el tip.
- [ ] Calcular gateway fee desde `fee_details`/net autoritativo sin incluir `application_fee`; fallar cerrado si no reconcilia.
- [ ] Reusar `processPaymentWebhook`, RPCs actuales y Web Push; evento duplicado no duplica nada.
- [ ] Ejecutar PASS.

### Task 7: Dashboard, retiros y textos

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/payouts/page.tsx`
- Create: `src/components/dashboard/mercadopago-connection-badge.tsx`
- Modify: `src/features/legal/content.ts`
- Modify: `src/features/legal/terms.ts`
- Test: `tests/ui/dashboard-mercadopago-status.test.tsx`
- Test: `tests/ui/fan-legal-consent.test.tsx`

- [ ] Escribir tests de moneda regional, badge conectado, saldo derivado y ausencia de formulario de retiro TipMe.
- [ ] Ejecutar RED.
- [ ] Mostrar saldo TipMe en MXN/COP y explicar que el dinero/retiro se administra en Mercado Pago.
- [ ] Actualizar términos a procesamiento directo/split y bump de versión legal.
- [ ] Ejecutar PASS.

### Task 8: Documentación y verificación final

**Files:**
- Modify: `README.md`, `.env.example`

- [ ] Documentar creación de apps Marketplace MX/CO, OAuth redirects y webhooks `/api/webhooks/mercadopago/MX|CO`.
- [ ] Documentar que las credenciales fake se reemplazan en `.env.local`/Vercel y que producción regional puede requerir cuenta local.
- [ ] Ejecutar `npm.cmd test -- tests/payments tests/security tests/ui/fan-single-screen-checkout.test.tsx tests/database/migration-safety.test.ts`.
- [ ] Ejecutar `npm.cmd run typecheck`, `npm.cmd run lint` y `npm.cmd run build`.
- [ ] Registrar como pendiente la prueba real de MX/CO; no declararla aprobada desde sandbox.

