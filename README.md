# TipMe

TipMe es un MVP web mobile-first para que una persona creadora comparta una URL pública y reciba tips verificables sin obligar al fan a registrarse.

```text
Fan envía tip
  -> el proveedor cobra en la cuenta conectada del creador
  -> webhook verificado por el servidor
  -> tip confirmado
  -> ledger y saldo neto del creador
  -> notificación interna
  -> Web Push
  -> retiro administrado por el proveedor
```

Dominio previsto: `https://tipme.pro`

Estado actual: **MVP con Mock, PayPal y Mercado Pago regional**. El modo `mercadopago` implementa Split Payments 1:1 para Argentina, Brasil, Chile, Colombia, México, Perú y Uruguay, con checkout de tarjeta embebido, comisión TipMe configurable y confirmación exclusiva por webhook. Cada región requiere credenciales reales propias; el código no equivale a aprobación comercial de Mercado Pago.

## Mercado Pago regional

Con `PAYMENT_PROVIDER=mercadopago`, cada creador conecta su propia cuenta mediante OAuth. El pago se crea usando el access token del creador y `application_fee`; el dinero no pasa por una cuenta TipMe. Los tokens se cifran con AES-256-GCM y se guardan en `payment_account_credentials`, una tabla sin permisos para `anon` ni `authenticated`.

```text
Argentina -> ARS    Brasil -> BRL       Chile -> CLP
Colombia  -> COP    México -> MXN       Perú  -> PEN
Uruguay   -> UYU
TipMe recibe PLATFORM_FEE_BPS=100 (1 %) mediante application_fee
```

Configura una aplicación Marketplace y credenciales por cada región que vayas a habilitar. Todas usan esta Redirect URI OAuth:

```text
https://tipme.pro/api/mercadopago/oauth/callback
```

Webhooks de pagos:

```text
https://tipme.pro/api/webhooks/mercadopago/MX
https://tipme.pro/api/webhooks/mercadopago/CO
https://tipme.pro/api/webhooks/mercadopago/PE
```

Sustituye el último segmento por `AR`, `BR`, `CL`, `CO`, `MX`, `PE` o `UY` según la región.

Suscribe eventos de pagos (`payment.created` y `payment.updated`). Cada URL usa el secret de firma de su región. El handler valida firma y antigüedad, consulta `/v1/payments/{id}` con el token del vendedor, cruza vendedor, tip, importe, moneda y `application_fee`, y recién después actualiza ledger, notificación y push. Una respuesta `approved` en el navegador nunca confirma el tip.

Variables:

```dotenv
PAYMENT_PROVIDER=mercadopago
PLATFORM_FEE_BPS=100
MERCADOPAGO_ENVIRONMENT=sandbox
PAYMENT_TOKEN_ENCRYPTION_KEY=BASE64_DE_32_BYTES
MERCADOPAGO_PE_CLIENT_ID=REEMPLAZAR
MERCADOPAGO_PE_CLIENT_SECRET=REEMPLAZAR
NEXT_PUBLIC_MERCADOPAGO_PE_PUBLIC_KEY=REEMPLAZAR
MERCADOPAGO_PE_WEBHOOK_SECRET=REEMPLAZAR
MERCADOPAGO_MX_CLIENT_ID=REEMPLAZAR
MERCADOPAGO_MX_CLIENT_SECRET=REEMPLAZAR
NEXT_PUBLIC_MERCADOPAGO_MX_PUBLIC_KEY=REEMPLAZAR
MERCADOPAGO_MX_WEBHOOK_SECRET=REEMPLAZAR
MERCADOPAGO_CO_CLIENT_ID=REEMPLAZAR
MERCADOPAGO_CO_CLIENT_SECRET=REEMPLAZAR
NEXT_PUBLIC_MERCADOPAGO_CO_PUBLIC_KEY=REEMPLAZAR
MERCADOPAGO_CO_WEBHOOK_SECRET=REEMPLAZAR
```

El archivo `.env.example` contiene además los bloques equivalentes para `AR`, `BR`, `CL` y `UY`. Solo es obligatorio reemplazar las regiones que realmente se habiliten.

Genera la clave de cifrado una sola vez, guárdala también fuera de Vercel y no la cambies mientras existan conexiones activas:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Las public keys pueden llegar al navegador. Client secrets, secrets de webhook, tokens OAuth y la clave de cifrado son exclusivamente server-side. El checkout usa Card Payment Brick; los campos adicionales y métodos disponibles dependen del país, riesgo y configuración que Mercado Pago otorgue a la aplicación.

## Qué está implementado

### Cuenta y onboarding de la persona creadora

- Registro e inicio de sesión con email y contraseña mediante Supabase Auth.
- Inicio de sesión rápido con Google OAuth.
- Redirección segura después del OAuth; una cuenta nueva continúa al onboarding.
- Perfil con nombre visible, username, foto, descripción e idioma.
- Username único, normalizado y con nombres del sistema reservados.
- Foto almacenada en Supabase Storage, con reemplazo y eliminación.
- Moneda según el proveedor: USD en los flujos PayPal existentes y la moneda local de la cuenta Mercado Pago conectada (ARS, BRL, CLP, COP, MXN, PEN o UYU).
- Onboarding adaptado al proveedor activo:
  - cuenta y payout simulados en modo mock;
  - un solo correo de destino PayPal personal en `platform_payouts`;
  - Partner Referrals únicamente en el modo Multiparty conservado.
- Activación de Web Push mediante una acción explícita desde el dashboard o Ajustes, sin bloquear el onboarding.
- URL pública directa: `tipme.pro/username`.

### Experiencia del fan

- Perfil público sin autenticación en `/[username]`.
- Importes rápidos adaptados a la moneda regional, además de monto personalizado.
- Nombre y mensaje opcionales; si el nombre queda vacío, el tip se guarda como anónimo.
- Consentimiento obligatorio de Términos y Política de reembolsos antes de iniciar el pago.
- Aporte voluntario para ayudar a cubrir el procesamiento, calculado nuevamente por el servidor.
- Pago mock para desarrollo y pruebas.
- Checkout PayPal en una sola pantalla: datos del tip, tarjeta y un único botón final **ENVIAR TIP**.
- PayPal Card Fields embebidos cuando la cuenta y el comprador son elegibles.
- Botón oficial de PayPal visible como alternativa cuando PayPal Wallet es elegible.
- La configuración segura se prepara sin crear una orden; el tip y la orden nacen al iniciar el pago.
- Comprobante protegido mediante token firmado.
- Estados de comprobante: pendiente, confirmado y rechazado.
- Botón para enviar otro tip al mismo perfil.
- Código de operación verificable y copiable en cada comprobante confirmado.
- Comprobante confirmado compartible como imagen PNG mediante Web Share API, con descarga como fallback.

El navegador nunca confirma un pago ni modifica un saldo. Incluso después de una captura iniciada desde el checkout, TipMe espera el webhook validado por el backend.

### Dashboard

- Saludo con foto de perfil o inicial como fallback.
- Badge **PayPal configurado** al guardar el correo y **PayPal verificado** después del primer payout exitoso.
- Resumen financiero PayPal:
  - **Total confirmado:** importe bruto histórico de tips actualmente confirmados;
  - **Hoy:** importe bruto confirmado durante el día;
  - **Comisiones descontadas:** comisión de plataforma más fee exacto informado por el gateway;
  - **Total neto:** importe confirmado después de esas comisiones.
- El total confirmado no se reinicia. Un refund o chargeback deja de contarse como confirmado.
- Los checkouts PayPal abandonados o pendientes no aparecen en esos totales ni en los tips recientes.
- Link público con acciones compactas para copiar y mostrar QR.
- QR en un modal, con opciones para compartir o descargar PNG.
- Cinco tips recientes en móvil y hasta seis en dos columnas desde pantallas mayores.
- Historial completo y detalle sencillo de cada tip.
- Actualización automática mediante Supabase Realtime, sin sumar dinero en el cliente.
- Centro de notificaciones internas.
- Navegación adaptada a móvil con estado activo visible.
- Ajustes de perfil y control push compacto junto a la foto.

### Pagos, ledger y seguridad financiera

- Interfaz `PaymentProvider` independiente del gateway.
- `MockPaymentProvider` para probar el recorrido sin dinero real.
- `PayPalPaymentProvider` para Checkout centralizado, Payouts y el modo Multiparty conservado.
- `MercadoPagoPaymentProvider` para cobro directo regional con `application_fee` y Card Payment Brick.
- Creación, consulta y captura separadas de la confirmación financiera.
- Webhook único en `/api/webhooks/payments`.
- Verificación de firma HMAC para mock y verificación oficial de webhook para PayPal.
- Idempotencia por evento y por identificadores del proveedor.
- Protección contra eventos duplicados y replay donde corresponde.
- Registro de eventos webhook y errores seguros.
- Estados de tip: `created`, `pending`, `confirmed`, `rejected`, `refunded` y `chargeback`.
- Ledger inmutable: no existe un campo balance editable.
- Entradas para tip confirmado, comisión de plataforma, gateway fee, payout, refund, chargeback, reserva y liberación.
- Refunds y reversals corrigen el ledger una sola vez.
- Los importes se guardan como unidades menores enteras; nunca como `float`.
- El gateway fee permanece `null` hasta que el proveedor informa un valor real.

### PWA, Realtime y Web Push

- Web App Manifest y modo `standalone`.
- Service Worker y fallback offline.
- Push API, Notifications API y claves VAPID.
- Una persona puede registrar varios dispositivos.
- Push al confirmar un tip y al completar o fallar un payout mock o PayPal.
- Tip anónimo sin filtración del nombre del fan.
- Deep link de tip a `/dashboard/tips/[tipId]`.
- Endpoints 404/410 se marcan como revocados.
- Badge de notificaciones cuando el navegador admite Badging API.
- En iPhone/iPad se detecta la necesidad de instalar la PWA antes de activar push.

### Legal y administración

- Términos de uso en `/terms`.
- Política de reembolsos en `/refund-policy`.
- Política de privacidad en `/privacy`.
- Contenido inicial en español e inglés.
- Registro de versión legal y fecha de aceptación para cada tip.
- Admin de solo lectura para estado general, perfiles, tips, payouts y webhooks.
- Roles iniciales: `creator` y `admin`.
- No existe una acción frontend para convertir una cuenta en admin.

## Lo que no incluye este MVP

- Cuentas o perfiles de fans.
- Feed, followers, chat, comentarios o publicaciones.
- Wallet, monedas virtuales, puntos o suscripciones.
- Apps nativas iOS o Android.
- Apple Pay o Google Pay integrados en la interfaz actual.
- APIs ficticias de Nuvei, EBANX o dLocal.
- KYC/KYB propio.
- Reembolsos manuales desde el panel: el ledger y los webhooks están preparados, pero todavía falta una interfaz operativa completa para disputas.
- Gestión completa de todos los eventos `CUSTOMER.DISPUTE.*`; actualmente se procesan refunds y reversals de captura.
- Rate limiting distribuido para tráfico alto.

## Stack

- Next.js 16.3 con App Router
- React 19
- TypeScript 5.9
- Tailwind CSS 4
- Supabase Auth, PostgreSQL, Storage y Realtime
- PWA, Service Worker y Web Push con VAPID
- PayPal REST API, Partner Referrals y JavaScript SDK Card Fields
- Vitest
- Vercel

No se usa ORM, librería de estado global, servidor tradicional ni microservicios.

## Estructura principal

```text
src/app                         Rutas, páginas y handlers HTTP
src/components                  Componentes visuales y controles cliente
src/features/auth               Autenticación y OAuth
src/features/profiles           Perfiles, usernames y Storage
src/features/payments           Providers, checkout, webhooks y repositorios
src/features/payouts            Payouts mock y reglas de saldo
src/features/notifications      Push, payloads y subscriptions
src/features/legal              Textos y versión legal
src/lib                         Entorno, Supabase, seguridad e i18n
supabase/migrations             Esquema, funciones, RLS y cambios incrementales
tests                           Pruebas de dominio, pagos, seguridad, push y UI
docs/manual                     Checklists manuales de DB y dispositivos
```

## Rutas principales

| Ruta | Uso |
| --- | --- |
| `/signup` | Crear una cuenta con email o Google |
| `/login` | Iniciar sesión con email o Google |
| `/onboarding` | Perfil, proveedor y link público |
| `/[username]` | Página pública para enviar tips sin cuenta |
| `/dashboard` | Resumen, link, QR y tips recientes |
| `/dashboard/tips` | Historial completo |
| `/dashboard/tips/[tipId]` | Detalle del tip |
| `/dashboard/notifications` | Centro de avisos |
| `/dashboard/payouts` | Retiros TipMe en mock/PayPal o estado directo administrado por Mercado Pago |
| `/dashboard/settings` | Perfil, foto, idioma y push |
| `/admin` | Estado general protegido |
| `/terms`, `/refund-policy`, `/privacy` | Documentos legales |

## Requisitos

- Node.js 22 o superior.
- npm 10 o superior.
- Proyecto Supabase.
- Cuenta Vercel para despliegue.
- Supabase CLI y Docker únicamente si se usará Supabase local.
- Para PayPal: app REST Sandbox con Checkout, Webhooks y Payouts habilitados. Multiparty solo requiere aprobación si se activa ese flujo.

## Instalación local

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Abre `http://localhost:3000`.

Los valores incluidos en `.env.example` son falsos. Sirven para instalar, ejecutar pruebas, validar tipos y compilar; no conectan Supabase, PayPal ni Web Push.

## Variables de entorno

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_PUBLISHABLE_O_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=TU_SECRET_O_SERVICE_ROLE_KEY

PLATFORM_FEE_BPS=100
PAYMENT_PROVIDER=mercadopago
MOCK_WEBHOOK_SECRET=GENERA_UN_SECRETO_LARGO
RECEIPT_SIGNING_SECRET=GENERA_OTRO_SECRETO_LARGO

PAYPAL_ENVIRONMENT=sandbox
PAYPAL_FLOW=platform_payouts
PAYPAL_SANDBOX_SINGLE_MERCHANT=false
PAYPAL_PAYOUT_FEE_BPS=200
PAYPAL_PAYOUT_FEE_CAP_MINOR=100
PAYPAL_CHECKOUT_FEE_BPS=540
PAYPAL_CHECKOUT_FIXED_FEE_MINOR=30
PAYOUT_HOLD_MINUTES=0
PAYPAL_SANDBOX_PAYOUT_RECIPIENT_ID=ACCOUNT_ID_SANDBOX_DE_PRUEBA
NEXT_PUBLIC_PAYPAL_CLIENT_ID=REEMPLAZAR
PAYPAL_CLIENT_SECRET=REEMPLAZAR
PAYPAL_WEBHOOK_ID=REEMPLAZAR
PAYPAL_PARTNER_MERCHANT_ID=REEMPLAZAR
PAYPAL_PARTNER_ATTRIBUTION_ID=

NEXT_PUBLIC_VAPID_PUBLIC_KEY=REEMPLAZAR
VAPID_PRIVATE_KEY=REEMPLAZAR
VAPID_SUBJECT=mailto:admin@tipme.pro

LEGAL_OPERATOR_NAME=
LEGAL_CONTACT_EMAIL=
```

Reglas importantes:

- Una variable `NEXT_PUBLIC_*` queda incluida en el bundle del navegador. Solo coloca allí datos públicos como URL, publishable key, client ID o clave VAPID pública.
- Nunca expongas `SUPABASE_SERVICE_ROLE_KEY`, `PAYPAL_CLIENT_SECRET`, `VAPID_PRIVATE_KEY`, `MOCK_WEBHOOK_SECRET` ni `RECEIPT_SIGNING_SECRET`.
- `PLATFORM_FEE_BPS=100` aplica 1 % en Mercado Pago Split Payments. Sigue siendo configurable.
- `PAYPAL_CHECKOUT_*` solo estima el aporte voluntario del fan; el ledger espera el fee real de PayPal.
- `PAYPAL_PAYOUT_FEE_*` reserva conservadoramente la comisión de envío; el webhook concilia la cifra real.
- `PAYPAL_SANDBOX_PAYOUT_RECIPIENT_ID` es un Account ID falso/de prueba para Sandbox. En Live se usa el correo guardado por la persona.
- Reinicia `npm run dev` después de modificar `.env.local`.
- En Vercel, cambia una variable y vuelve a desplegar para que el cambio llegue al build.

## Configuración de Supabase

### Migraciones

Ejecuta las migraciones en este orden:

1. `202608120001_tipme_core.sql`: tablas, enums, funciones financieras, Storage y RLS.
2. `202608130001_fix_username_double_underscore.sql`: corrige la validación de usernames.
3. `202608160001_set_application_currency_usd.sql`: fija USD para el piloto sin relabeling del historial financiero.
4. `202608160002_paypal_payment_accounts.sql`: cuentas PayPal conectadas e identificadores de captura.
5. `202608180003_tip_legal_acceptance.sql`: versión y fecha de aceptación legal.
6. `202608180004_creator_tip_totals.sql`: agregados seguros del resumen financiero PayPal.
7. `202608200001_paypal_platform_payouts.sql`: importes base/aporte, destino PayPal protegido, reservas, Payouts, fees reales e idempotencia.
8. `202608200002_creator_base_tip_amounts.sql`: reconstruye y muestra al creador el importe base del tip sin sumar el aporte voluntario.
9. `202608200003_tip_operation_codes.sql`: añade códigos públicos únicos para verificar operaciones y buscar tips.
10. `202608200004_fix_payout_ledger_conflicts.sql`: corrige transiciones idempotentes de payouts.
11. `202608200005_mercadopago_regional_accounts.sql`: añade MXN, cuentas regionales y credenciales OAuth privadas.
12. `202608210001_mercadopago_all_regions.sql`: habilita las siete regiones de Split Payments y añade UYU.

Con Supabase CLI:

```powershell
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

También puedes copiar cada archivo, respetando el orden, en Supabase Dashboard → SQL Editor.

Las migraciones `202608200001`, `202608200002` y `202608200003` deben aplicarse, en ese orden, antes de desplegar esta versión. Sin ellas faltarán el flujo de retiros, los importes base y los códigos de operación.

### Supabase local y datos demo

```powershell
supabase start
supabase db reset
```

`db reset` aplica todas las migraciones y `supabase/seed.sql`.

Datos demo locales:

- Email: `camila@demo.tipme.pro`
- Contraseña: `TipMe-Demo-2026!`
- Perfil: `http://localhost:3000/camila`

No ejecutes el seed en producción. Sus UUID son determinísticos para poder localizar y eliminar los datos demo.

### Storage

La migración principal crea el bucket público `avatars` con límite de 5 MB. La aplicación acepta JPEG, PNG, WebP y AVIF y valida tipo y tamaño en el servidor.

### RLS

RLS protege perfiles privados, tips, ledger, payouts, notificaciones, cuentas de pago y subscriptions push. La persona creadora solo puede consultar sus datos; las escrituras financieras se realizan mediante funciones controladas o service role.

## Google OAuth

1. En Google Cloud crea un cliente OAuth Web.
2. En orígenes JavaScript autorizados añade:
   - `http://localhost:3000`
   - `https://tipme.pro`
3. En URIs de redirección autorizados añade exactamente:
   - `https://TU-PROJECT-REF.supabase.co/auth/v1/callback`
4. En Supabase → Authentication → Providers → Google, activa el proveedor y pega client ID y client secret.
5. En Supabase → Authentication → URL Configuration configura:
   - Site URL de producción: `https://tipme.pro`
   - Redirect URLs: `http://localhost:3000/auth/callback` y `https://tipme.pro/auth/callback`

El callback de Google siempre llega primero a Supabase. Después Supabase devuelve al usuario a `/auth/callback` en TipMe. Un `redirect_uri_mismatch` se corrige en Google Cloud utilizando la URL de Supabase completa, no la URL de Vercel.

El consentimiento de Google mostrará el hostname de Supabase mientras no se configure un custom auth domain.

## Web Push y VAPID

Genera un par de claves real una sola vez:

```powershell
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Configura:

```dotenv
NEXT_PUBLIC_VAPID_PUBLIC_KEY=CLAVE_PUBLICA
VAPID_PRIVATE_KEY=CLAVE_PRIVADA
VAPID_SUBJECT=https://tipme.pro
```

La clave pública VAPID válida decodifica a 65 bytes. Las cadenas falsas de `.env.example` permiten compilar, pero no activar push.

Web Push requiere HTTPS, salvo `localhost`. La petición de permiso siempre ocurre después de pulsar la campana en el dashboard o Ajustes.

En iPhone/iPad:

1. Abre TipMe en Safari.
2. Pulsa Compartir → Añadir a pantalla de inicio.
3. Abre TipMe desde el icono instalado.
4. Inicia sesión y activa la campana de notificaciones.

Cada dispositivo debe activar sus propias notificaciones. Haberlas activado en una laptop no registra automáticamente el iPhone.

Consulta el checklist real en [docs/manual/push-device-checklist.md](docs/manual/push-device-checklist.md).

Para el recorrido financiero Sandbox usa [docs/manual/paypal-platform-payouts-checklist.md](docs/manual/paypal-platform-payouts-checklist.md).

## Flujo de pagos mock

Configura:

```dotenv
PAYMENT_PROVIDER=mock
```

1. Abre `/camila` sin iniciar sesión como fan.
2. Elige importe, nombre, mensaje y anonimato.
3. Acepta los términos y pulsa `ENVIAR TIP`.
4. En `/pay/mock/[paymentId]` simula aprobado, pendiente o rechazado.
5. La simulación aprobada crea un evento firmado y ejecuta el mismo procesador server-side del webhook.

Los simuladores responden 404 en Vercel Production. Para una demo desplegada con mock utiliza un Vercel Preview Deployment.

## PayPal Sandbox

### Capacidades esperadas

La implementación utiliza:

- REST Orders API con `CAPTURE`.
- JavaScript SDK con `buttons,card-fields`.
- Payouts API para enviar retiros a una cuenta PayPal personal.
- Un `sender_batch_id` y `sender_item_id` derivados del UUID interno para evitar envíos duplicados.
- Partner Referrals, `payee` y `payment_instruction.platform_fees` solo cuando `PAYPAL_FLOW=multiparty`.
- `NO_SHIPPING` porque un tip no envía productos.
- Verificación de firma mediante `/v1/notifications/verify-webhook-signature`.

Card Fields muestra número, vencimiento y CVV dentro de TipMe cuando PayPal declara elegible la transacción. PayPal puede solicitar datos adicionales, login o verificación según país, riesgo y cuenta; TipMe no puede eliminar esos requisitos.

### Variables PayPal

```dotenv
PAYMENT_PROVIDER=paypal
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_FLOW=platform_payouts
PAYPAL_SANDBOX_SINGLE_MERCHANT=false
PLATFORM_FEE_BPS=0
PAYPAL_PAYOUT_FEE_BPS=200
PAYPAL_PAYOUT_FEE_CAP_MINOR=100
PAYPAL_CHECKOUT_FEE_BPS=540
PAYPAL_CHECKOUT_FIXED_FEE_MINOR=30
PAYPAL_SANDBOX_PAYOUT_RECIPIENT_ID=ACCOUNT_ID_SANDBOX
NEXT_PUBLIC_PAYPAL_CLIENT_ID=CLIENT_ID_SANDBOX
PAYPAL_CLIENT_SECRET=SECRET_SANDBOX
PAYPAL_WEBHOOK_ID=WEBHOOK_ID_SANDBOX
PAYPAL_PARTNER_MERCHANT_ID=PARTNER_MERCHANT_ID
PAYPAL_PARTNER_ATTRIBUTION_ID=BN_CODE
```

El webhook debe apuntar a:

```text
https://tipme.pro/api/webhooks/payments
```

Eventos mínimos:

- `PAYMENT.CAPTURE.PENDING`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DECLINED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED`
- `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`
- `PAYMENT.PAYOUTS-ITEM.FAILED`
- `PAYMENT.PAYOUTS-ITEM.BLOCKED`
- `PAYMENT.PAYOUTS-ITEM.RETURNED`
- `PAYMENT.PAYOUTS-ITEM.CANCELED`
- `PAYMENT.PAYOUTS-ITEM.REFUNDED`
- `PAYMENT.PAYOUTS-ITEM.HELD`
- `PAYMENT.PAYOUTS-ITEM.UNCLAIMED`

No selecciones `All Events` para el piloto.

### Onboarding PayPal del piloto

Con `PAYPAL_FLOW=platform_payouts`, el paso 2 solicita un único correo PayPal. Se normaliza server-side y queda `pending`. TipMe no pide contraseña, banco, tarjeta ni OAuth. El destino cambia a `verified` únicamente después de un payout `SUCCESS`.

En Sandbox, los retiros exitosos usan el Account ID configurado en `PAYPAL_SANDBOX_PAYOUT_RECIPIENT_ID`, porque muchos correos ficticios Sandbox no están confirmados. En Live el payout usa `recipient_type: EMAIL` y el correo guardado por la persona.

### Multiparty conservado

En el paso 2 del onboarding, TipMe abre Partner Referrals en una ventana tipo minibrowser. La aplicación:

- conserva un `state` firmado para evitar manipulación;
- recibe el callback de PayPal;
- consulta el estado de integración del merchant;
- verifica `payments_receivable`, email y onboarding;
- guarda únicamente merchant ID, capacidades y estado, nunca credenciales PayPal;
- consulta periódicamente la base de datos y permite una comprobación manual si PayPal no cierra la ventana.

Esta ruta solo se usa con `PAYPAL_FLOW=multiparty` y requiere las aprobaciones correspondientes. No es el modo activo del piloto.

### Modo Sandbox legado con un solo merchant

Si todavía no tienes Multiparty habilitado, puedes probar Checkout, captura, webhook, ledger y push con una sola cuenta Business Sandbox:

```dotenv
PAYMENT_PROVIDER=paypal
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_SANDBOX_SINGLE_MERCHANT=true
PAYPAL_PARTNER_ATTRIBUTION_ID=
```

En este modo:

- no se envían `PayPal-Auth-Assertion`, `payee` ni `platform_fees`;
- todo el dinero de prueba llega a `PAYPAL_PARTNER_MERCHANT_ID`;
- la comisión de plataforma y el saldo creador son una simulación del ledger;
- no se demuestra reparto real de fondos;
- el modo está bloqueado si `PAYPAL_ENVIRONMENT=live`.

El BN Code es opcional en esta modalidad.

### Dinero real

No cambies a Live solo porque Sandbox funciona. Antes comprueba:

- que la app Live tenga Payouts habilitado y fondos suficientes;
- Advanced Credit and Debit Card Payments;
- los países de cobro y recepción admitidos;
- el proceso de refunds, contracargos, reservas, retenciones y saldo negativo;
- los datos legales y de soporte del operador.

En `platform_payouts`, el fan paga a la cuenta Business de TipMe y TipMe envía después el saldo mediante Payouts. No debe describirse como un pago directo fan → creador. Multiparty puede retomarse más adelante sin cambiar el ledger ni la interfaz principal.

## Ledger, fees y totales

- Monedas activas: USD en PayPal; ARS, BRL, CLP, COP, MXN, PEN y UYU en Mercado Pago regional.
- `20.00` se guarda como `2000` en las monedas con dos decimales.
- Comisión de plataforma recomendada para Mercado Pago: 1 %, configurada con `PLATFORM_FEE_BPS=100`.
- Fee de cobro PayPal: se registra desde `seller_receivable_breakdown.paypal_fee`; si el webhook no lo trae, el servidor consulta la captura antes de acreditar.
- `base_amount_minor` guarda el tip elegido y `processing_support_minor` el aporte voluntario; ambos reconstruyen `amount_minor`.
- Neto: tip bruto menos comisión de plataforma menos gateway fee.
- `creator_balances` reconstruye siempre el saldo disponible desde `ledger_entries`.
- `creator_tip_totals` calcula el resumen PayPal usando solo tips actualmente confirmados.

No se realiza conversión de moneda: cada cuenta conectada recibe y muestra la moneda de su región.

## Payouts

### Modo mock

- Cuenta bancaria simulada con banco, país, estado y últimos cuatro dígitos.
- Estados `requested`, `processing`, `completed` y `failed`.
- No permite solicitar más que el saldo disponible.
- Usa reserva y liberación en el ledger.
- Genera notificación interna y push al completar o fallar.
- Muestra el total histórico retirado.

### Modo PayPal

- La persona configura un correo PayPal personal, inicialmente `pending`.
- Puede retirar cualquier monto positivo que no supere su saldo disponible; no hay máximo adicional.
- La interfaz muestra cuánto se debita, cuánto se enviará y la comisión reservada estimada.
- La reserva se crea en PostgreSQL antes de llamar PayPal.
- Un 4xx definitivo libera la reserva; un timeout o 5xx la conserva para conciliación y evita reintentos con otro identificador.
- `SUCCEEDED` registra `reserve_release`, `payout`, el fee real, verifica el destino y envía push.
- `FAILED`, `RETURNED`, `CANCELED` o `REFUNDED` liberan el dinero no enviado y notifican el fallo.
- `UNCLAIMED` solicita cancelación y conserva la reserva hasta recibir un estado final.
- El historial muestra el importe enviado y diferencia comisión estimada de comisión real.

## Legal

Las páginas legales son plantillas iniciales para el piloto y no sustituyen revisión profesional. Antes de pagos reales completa:

```dotenv
LEGAL_OPERATOR_NAME=Nombre legal del operador
LEGAL_CONTACT_EMAIL=correo@dominio.com
```

La versión legal actual está en `src/features/legal/terms.ts`. Cambiar los documentos requiere actualizar deliberadamente esa versión para que los nuevos tips registren qué texto fue aceptado.

## Pruebas

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

La suite cubre, entre otros:

- dinero entero y comisión por basis points;
- usernames válidos y reservados;
- creación de tips sin cuenta fan;
- anonimato;
- consentimiento legal;
- MockPaymentProvider;
- PayPal Orders, Card Fields, Payouts y Multiparty conservado;
- firma y procesamiento de webhooks;
- idempotencia, refunds y chargebacks;
- comprobantes firmados;
- ledger y límites de payout;
- subscriptions push, múltiples dispositivos y endpoints revocados;
- OAuth y sanitización de redirects;
- dashboard, QR, navegación, destino PayPal pendiente/verificado y ajustes.

La verificación SQL/RLS está en [docs/manual/database-verification.md](docs/manual/database-verification.md).

## PWA

- Manifest: `/manifest.webmanifest`
- Service Worker: `/sw.js`
- Iconos: `public/icons`
- Favicon: `src/app/icon.svg`
- Inicio instalado: `/dashboard`
- Fallback offline: `/offline`
- Deep link del tip: `/dashboard/tips/[tipId]`

## Despliegue en Vercel y dominio

1. Sube el proyecto a un repositorio privado o impórtalo directamente en Vercel.
2. Configura las variables de entorno reales para Production y Preview.
3. Usa `NEXT_PUBLIC_APP_URL=https://tipme.pro` en producción.
4. Añade `tipme.pro` como dominio en Vercel y configura los DNS indicados.
5. Configura Site URL y redirects de Supabase para `https://tipme.pro`.
6. Actualiza Google OAuth con el origen de producción.
7. Ejecuta todas las migraciones contra el proyecto Supabase correcto.
8. Configura el webhook Sandbox o Live con la URL del dominio correspondiente.
9. Despliega.
10. Prueba OAuth, checkout, webhook, Realtime y push en dispositivos reales.

El build command es `npm run build`.

## Checklist mínimo del piloto

1. Crear una cuenta nueva.
2. Completar perfil, username y foto.
3. Guardar el correo PayPal de destino o configurar payout mock.
4. Instalar la PWA y activar push desde el dispositivo que recibirá avisos.
5. Copiar el link o compartir el QR.
6. Abrir el perfil desde incógnito u otro dispositivo.
7. Enviar y confirmar un tip.
8. Verificar una sola fila de webhook, notificación y efecto financiero.
9. Confirmar que el dashboard se actualiza sin refresh manual.
10. Tocar el push y verificar el deep link.
11. Repetir el webhook y confirmar que no duplica dinero ni notificaciones.
12. En PayPal Sandbox, completar un payout al Account ID de prueba y confirmar fee, ledger y push.
13. Probar `UNCLAIMED` o un fallo Sandbox y verificar que la reserva solo se libera en un estado final.

## Seguridad

- No se almacenan números completos de tarjeta, CVV, contraseñas bancarias ni credenciales PayPal.
- Todos los inputs relevantes se validan en el servidor.
- Los comprobantes usan tokens firmados y no permiten consultar tips arbitrarios.
- Los callbacks OAuth y PayPal validan destinos y estado.
- Los webhooks usan el body crudo para verificar autenticidad.
- RLS limita datos por creador.
- Service role, secretos PayPal y VAPID privada solo se usan server-side.
- El admin es observacional para evitar ajustes financieros accidentales.

## Límites antes de producción

- El rate limit actual está en memoria por instancia y es suficiente solo para un piloto pequeño. Debe migrarse a una store distribuida antes de tráfico real.
- Push debe validarse físicamente en iPhone y Android; una prueba desktop no certifica entrega móvil.
- La latencia del push depende del proveedor, red, sistema operativo y ahorro de batería; no se promete un tiempo específico.
- PayPal decide elegibilidad, campos requeridos, reservas, retenciones y disponibilidad de fondos.
- Las políticas legales necesitan revisión profesional y datos reales del operador.
- Debe definirse un proceso de soporte para refunds, operaciones no autorizadas y disputas.

Para asignar el primer admin, hazlo únicamente desde Supabase SQL Editor o una operación server-side controlada:

```sql
update public.profiles
set role = 'admin'
where id = 'UUID_DEL_USUARIO';
```

## Añadir otro gateway en el futuro

Implementa un adapter nuevo que cumpla `PaymentProvider` usando únicamente documentación oficial y credenciales Sandbox. Regístralo en `src/features/payments/provider-factory.ts`.

El adapter debe encargarse de:

- crear y consultar pagos;
- capturar cuando corresponda;
- verificar y parsear webhooks;
- crear y consultar payouts si el proveedor los administra mediante API;
- informar fees exactos;
- proporcionar identificadores de cuenta y estados KYC/KYB.

No debe cambiar las reglas principales del ledger, idempotencia, dashboard, notificaciones ni confirmación server-side.
