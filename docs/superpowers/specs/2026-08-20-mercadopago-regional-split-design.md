# TipMe — Mercado Pago regional con Split Payments 1:1

## Objetivo

Permitir que creadores de México y Colombia conecten su propia cuenta Mercado Pago y reciban tips directamente. Mercado Pago descuenta procesamiento, TipMe cobra `PLATFORM_FEE_BPS=100` mediante `application_fee`, y TipMe conserva comprobante, ledger, Realtime y push sin custodiar fondos.

## Alcance inicial

- Países: México (`MX`, `MXN`) y Colombia (`CO`, `COP`).
- Checkout: Card Payment Brick dentro de TipMe.
- Conexión de creador: OAuth Authorization Code con PKCE.
- Confirmación financiera: únicamente webhook firmado más consulta autoritativa del Payment.
- Proveedores `mock` y `paypal` permanecen disponibles por configuración.
- Mercado Pago no usa el menú de retiros de TipMe: el creador administra el dinero en su propia cuenta.

## Arquitectura regional

Cada país tiene credenciales de aplicación independientes:

```text
MX -> client id/secret, public key, webhook secret, auth.mercadopago.com.mx, MXN
CO -> client id/secret, public key, webhook secret, auth.mercadopago.com.co, COP
```

La selección la hace el creador al conectar su cuenta. El país, moneda y `user_id` de Mercado Pago quedan asociados a `payment_accounts`. Los access/refresh tokens se cifran con AES-256-GCM y se guardan en una tabla privada accesible solo por `service_role`.

## Onboarding

1. El creador completa perfil TipMe.
2. Elige dónde está registrada su cuenta Mercado Pago: México o Colombia.
3. TipMe genera estado y PKCE, guardados en cookies `HttpOnly`, `SameSite=Lax`, con expiración de diez minutos.
4. Mercado Pago devuelve `code`; TipMe verifica estado, intercambia el código server-side y guarda tokens cifrados.
5. TipMe consulta `/users/me` con el token para obtener el `user_id` real y comprobar que la cuenta corresponde al país esperado.
6. La cuenta queda `connected`; TipMe nunca solicita contraseña, banco o tarjeta del creador.

## Pago del fan

La página pública obtiene del servidor solo país, moneda y public key regional. El fan elige monto, nombre y mensaje; Card Payment Brick recolecta los campos requeridos por Mercado Pago y tokeniza la tarjeta. Su `onSubmit` envía el token de un solo uso y datos mínimos a TipMe.

El backend vuelve a validar creador, cuenta conectada, moneda, monto, aceptación legal y calcula `application_fee` con enteros. Crea el tip, descifra el access token del creador y llama `/v1/payments` con `X-Idempotency-Key`, `external_reference=tip_id`, `notification_url`, `transaction_amount`, `application_fee` y el payload de pago validado. El tip permanece `pending` aunque la respuesta inmediata diga `approved`.

## Webhook

Endpoint: `POST /api/webhooks/mercadopago/[country]`.

1. Lee `data.id` y valida `x-signature`/`x-request-id` con `WebhookSignatureValidator` y el secreto del país.
2. Localiza el tip por `provider_payment_id`; si todavía no está adjunto, usa `user_id` y consulta el Payment con la credencial de la cuenta conectada correspondiente.
3. Consulta `/v1/payments/{id}` con el access token OAuth del creador.
4. Verifica `external_reference`, collector/user id, moneda, importe y `application_fee` contra DB.
5. Normaliza status y fees reales.
6. Reutiliza las RPC actuales para confirmar/rechazar/revertir, crear ledger/notificación y enviar push de forma idempotente.

Nunca se confirma usando el resultado del Brick, una success URL o el body no verificado del webhook.

## Dinero y visualización

- Todo se almacena en unidades menores, nunca float.
- México usa `MXN`; Colombia usa `COP`; ambas con dos decimales en TipMe.
- El dashboard usa la moneda de la cuenta Mercado Pago conectada.
- `tip_confirmed` acredita el monto del tip, `platform_fee` descuenta 1% y `gateway_fee` descuenta la comisión real de Mercado Pago.
- El saldo TipMe es un registro derivado de tips, no una wallet ni el saldo total de Mercado Pago.
- Retiros se administran en Mercado Pago; TipMe muestra un enlace informativo, no un botón que mueva dinero.

## Seguridad

- Client secret, access token, refresh token y webhook secret solo server-side.
- Public key regional sí puede enviarse al navegador.
- Tokens OAuth cifrados y nunca disponibles por RLS a `authenticated`.
- State, PKCE, ownership checks, Zod, rate limiting e idempotencia obligatorios.
- Logs solo con códigos controlados, ids internos/proveedor y timestamps; nunca tokens ni payload completo del pagador.
- Los refresh tokens se renuevan server-side cuando sea necesario y el nuevo par se cifra antes de persistir.

## Limitaciones declaradas

- Tener código multipaís no garantiza credenciales productivas locales; México y Colombia deben habilitarse con credenciales válidas propias.
- El sandbox de Marketplace puede comportarse distinto a producción; la prueba final requiere operaciones reales mínimas autorizadas.
- No se promete aceptación de todas las tarjetas extranjeras.
- Países fuera de MX/CO permanecen con proveedor no disponible o con PayPal según configuración futura.

