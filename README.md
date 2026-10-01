# TipMe

TipMe es una aplicación de propinas en USD para contenido público ya compartido. El flujo operativo actual usa PayPal; Stripe Connect está documentado como una propuesta futura y todavía no forma parte del runtime.

## Flujo actual

1. La creadora inicia sesión y publica su perfil `tipme.pro/<username>`.
2. TipMe valida que el perfil y la actividad estén habilitados para recibir tips.
3. La creadora configura PayPal mediante uno de estos modos:
   - `platform_payouts`: TipMe cobra y envía retiros al correo PayPal configurado.
   - `multiparty`: PayPal cobra directamente para la cuenta conectada de la creadora.
4. El fan elige el importe, acepta los términos y completa el checkout de PayPal.
5. El backend confirma el pago mediante captura y webhooks verificados antes de actualizar el recibo, historial y ledger.

La aplicación conserva autenticación, perfiles, revisión de cumplimiento, recibos firmados, notificaciones, ledger y payouts porque forman parte directa del recorrido de pagos.

## Requisitos

- Node.js compatible con Next.js 16.3
- npm
- Proyecto Supabase
- Aplicación PayPal y credenciales del entorno elegido

## Configuración local

```bash
npm install
copy .env.example .env.local
npm run dev
```

Variables principales:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=REEMPLAZAR
SUPABASE_SERVICE_ROLE_KEY=REEMPLAZAR

PAYMENT_PROVIDER=paypal
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_JS_SDK_VERSION=v6
PAYPAL_FLOW=platform_payouts
NEXT_PUBLIC_PAYPAL_CLIENT_ID=REEMPLAZAR
PAYPAL_CLIENT_SECRET=REEMPLAZAR
PAYPAL_WEBHOOK_ID=REEMPLAZAR
PAYPAL_PARTNER_MERCHANT_ID=REEMPLAZAR
RECEIPT_SIGNING_SECRET=GENERA_UN_SECRETO_LARGO
```

Consulta [.env.example](.env.example) para la lista completa y los valores de desarrollo seguros.

## PayPal

### Platform payouts

Usa `PAYPAL_FLOW=platform_payouts`. La creadora registra su correo PayPal y TipMe gestiona el retiro desde el saldo confirmado. Configura las comisiones estimadas con `PAYPAL_PAYOUT_FEE_BPS` y `PAYPAL_PAYOUT_FEE_CAP_MINOR`.

### Multiparty

Usa `PAYPAL_FLOW=multiparty`. Cada creadora completa el onboarding de PayPal y el checkout se crea para su merchant conectado. Este modo requiere configuración Partner válida.

`PAYPAL_SANDBOX_SINGLE_MERCHANT=true` existe únicamente para pruebas Sandbox y no puede usarse con `PAYPAL_ENVIRONMENT=live`.

Webhook de pagos:

```text
https://tu-dominio.example/api/webhooks/payments
```

## Stripe

Stripe no está implementado ni habilitado. Su incorporación requiere revisar la elegibilidad de la plataforma, los países admitidos y las condiciones de negocio, además de una implementación separada. No configures secretos ni anuncies disponibilidad de Stripe hasta completar ese trabajo.

## Base de datos

Aplica las migraciones de `supabase/migrations` en orden. Algunos archivos históricos contienen esquemas de integraciones retiradas; se conservan deliberadamente porque el historial de migraciones es append-only y no debe reescribirse en instalaciones existentes.

El seed local usa identificadores deterministas y pagos PayPal de demostración. No lo ejecutes sobre producción.

## Verificación

```bash
npm run typecheck
npm run lint
npm test -- --maxWorkers=1
npm run build
```

## Seguridad

- No expongas `SUPABASE_SERVICE_ROLE_KEY`, `PAYPAL_CLIENT_SECRET`, `VAPID_PRIVATE_KEY` ni `RECEIPT_SIGNING_SECRET`.
- La confirmación financiera debe provenir del servidor y de eventos verificados, nunca de una redirección del navegador.
- Los recibos usan tokens firmados y los endpoints públicos aplican rate limiting.
- Los cambios de estado financiero deben seguir siendo idempotentes y tolerar webhooks duplicados o desordenados.
