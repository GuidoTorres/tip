# Plan de implementación: piloto Whop App

**Diseño:** `docs/superpowers/specs/2026-08-25-whop-app-pilot-design.md`

**Objetivo:** agregar Whop como proveedor opcional, permitir crear TipMe sin conectarlo y bloquear pagos hasta verificar una empresa Whop instalada.

## 1. Configuración y base de datos

- Crear pruebas de configuración para `PAYMENT_PROVIDER=whop` y secretos falsos.
- Ampliar el esquema de entorno y la factory sin modificar proveedores existentes.
- Crear migración reversible que permita `provider='whop'` en `payment_accounts`.
- Limpiar cualquier credencial con apariencia real de `.env.example`.

## 2. Cliente Whop y vinculación

- Crear pruebas para validar formato `biz_...`, rechazo sin instalación/permisos y conexión correcta.
- Implementar cliente server-side mínimo usando la API oficial.
- Agregar acción autenticada que consulta `GET /companies/{id}` antes de guardar la cuenta.
- No guardar tokens por creador; usar solo la App API Key del servidor.

## 3. Onboarding corto y activación posterior

- Probar que completar perfil termina la cuenta sin exigir Whop.
- Quitar el paso financiero del onboarding cuando el proveedor sea Whop.
- Añadir tarjeta de activación en dashboard y una ruta sencilla de conexión.
- Mostrar estado conectado cuando la verificación termine.

## 4. Bloqueo de tips sin cuenta conectada

- Probar que la página pública sigue visible pero no presenta pago activo.
- Probar que el backend rechaza la creación del tip aunque se manipule el frontend.
- Mostrar `Esta página todavía no acepta tips` hasta que Whop esté conectado.

## 5. Checkout Whop

- Escribir pruebas del adaptador para importe en unidades menores, USD, `company_id`, metadata, idempotencia y URL segura.
- Implementar checkout configuration de pago único sin `application_fee_amount`.
- Devolver `purchase_url` como checkout redirect.
- Consultar estado autoritativo del pago.

## 6. Webhook Whop

- Probar firma válida, tampering, timestamp/replay, eventos duplicados y mapeo de estados.
- Verificar Standard Webhooks sobre el cuerpo crudo.
- Agregar `/api/webhooks/whop` y reutilizar `handlePaymentWebhook`.
- Validar pago, metadata y empresa contra el tip antes de confirmar.
- Mapear pago exitoso/pendiente/fallido, reembolso y disputa.

## 7. Documentación y verificación

- Actualizar README y variables necesarias para crear la Whop App, permisos, instalación y webhook.
- Ejecutar tests focalizados tras cada bloque.
- Ejecutar al final `typecheck`, `lint`, suite completa y `build`.
- Dejar como prueba manual obligatoria el checkout y webhook reales de sandbox; no afirmar que el dinero llega hasta observarlo en Whop.

## Límite de alcance

Terminar cuando el adaptador, bloqueo, vinculación, webhook y pruebas locales funcionen. No implementar Platforms, comisiones, payouts propios, afiliados ni transactional outbox en este cambio.
