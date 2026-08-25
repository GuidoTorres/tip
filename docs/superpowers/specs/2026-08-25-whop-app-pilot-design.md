# Piloto Whop App para TipMe

## Objetivo

Validar TipMe con familiares mediante cuentas normales de Whop, sin Whop for Platforms y sin que TipMe custodie dinero.

Cada creador crea su propia cuenta/empresa en Whop, completa la verificación exigida por Whop e instala la app TipMe. Los tips se cobran bajo esa empresa y quedan en su saldo de Whop. TipMe registra el pago confirmado, actualiza su ledger y envía la notificación push.

## Alcance del piloto

- Proveedor nuevo `whop`, sin eliminar `mock`, Mercado Pago ni dLocal Go.
- Comisión de TipMe en `0%` durante el piloto (`PLATFORM_FEE_BPS=0`).
- Checkout alojado por Whop, inicialmente en USD.
- El fan no crea una cuenta TipMe.
- El creador administra KYC, saldo y retiros dentro de Whop.
- TipMe conserva su dashboard, recibos, código de operación, ledger, Realtime y Web Push.

## Alta y activación de cobros

Crear una cuenta TipMe y habilitar cobros son procesos separados para evitar que el registro resulte largo o parezca obligar a crear dos cuentas seguidas.

### Alta de TipMe

1. El creador se registra o inicia sesión.
2. Completa su perfil y crea su página pública.
3. Entra inmediatamente al dashboard. Su cuenta TipMe queda creada aunque todavía no tenga Whop.

### Activación posterior de cobros

1. El dashboard muestra una tarjeta clara pero no bloqueante: `Activa los tips conectando Whop`.
2. Desde esa tarjeta, el creador puede crear/abrir una cuenta normal de Whop e instalar la app TipMe cuando esté listo.
3. El creador pega el identificador de su empresa Whop (`biz_...`).
4. El servidor usa exclusivamente la App API Key para comprobar que TipMe tiene acceso a esa empresa. Un ID escrito en el navegador nunca se considera válido por sí solo.
5. Solo después de la verificación se guarda `payment_accounts.provider = 'whop'`, el `biz_...` y el estado conectado.

Mientras Whop no esté conectado y verificado, la URL pública puede mostrarse y compartirse, pero no permite iniciar pagos. El fan ve un estado neutro: `Esta página todavía no acepta tips`. El frontend no puede saltarse este bloqueo porque el backend también exige una cuenta de pago conectada.

La automatización del retorno desde la instalación se deja fuera del piloto. El flujo manual permite comprobar la experiencia real sin depender de Whop Platforms.

## Flujo del tip

1. El fan elige un importe en `tipme.pro/{username}`.
2. El backend crea el tip en estado `created` o `pending`.
3. `WhopPaymentProvider` crea una checkout configuration de pago único para el `company_id` del creador, con `tip_id` en metadata e idempotency key.
4. El fan paga en el checkout seguro de Whop.
5. La página de retorno solo consulta el estado; nunca confirma el dinero.
6. El webhook firmado de Whop llega al backend.
7. El backend valida firma, consulta autoritativamente el pago y comprueba que su `company_id` coincide con la cuenta Whop vinculada al creador del tip.
8. El procesamiento existente confirma el tip una sola vez, crea ledger y notificación, actualiza el dashboard y dispara Web Push.

## Webhooks y seguridad

- Endpoint: `/api/webhooks/whop`.
- Eventos mínimos: pago exitoso, pendiente/fallido, reembolso y disputa.
- Firma verificada con el mecanismo oficial de Standard Webhooks de Whop.
- El `event id` se usa para idempotencia y el cuerpo se conserva para auditoría.
- Un webhook no puede confirmar un tip si importe, moneda, metadata, empresa o identificador de pago no coinciden con los datos guardados.
- Las claves de la app y del webhook existen solo en el servidor.
- No se aceptará un `application_fee_amount` en este piloto.

## Variables

```dotenv
PAYMENT_PROVIDER=whop
PLATFORM_FEE_BPS=0
WHOP_ENVIRONMENT=sandbox
WHOP_APP_ID=app_fake_replace_me
WHOP_API_KEY=whop_fake_replace_me
WHOP_WEBHOOK_SECRET=whsec_fake_replace_me
```

`.env.example` contendrá solamente credenciales falsas.

## Pruebas obligatorias antes del piloto real

1. Una empresa Whop normal puede instalar TipMe y la App API Key puede leerla.
2. TipMe puede crear un checkout bajo esa empresa sin acceso a Platforms.
3. Un fan puede pagar como invitado en el checkout soportado por Whop.
4. El webhook de la app recibe el pago de una empresa que instaló TipMe.
5. El webhook confirmado crea un solo movimiento, recibo y notificación aunque se repita.
6. El dinero aparece en el saldo Whop del creador, no en el de TipMe.
7. Reembolso y disputa corrigen el ledger sin duplicados.

Si cualquiera de los puntos 1 a 4 falla en sandbox, el proveedor `whop` no se activa en producción y no se continúa construyendo sobre una suposición.

## Fuera de alcance

- Whop for Platforms y connected accounts.
- Custodia de fondos o retiros enviados por TipMe.
- Comisión por afiliado o `application_fee_amount`.
- Crear automáticamente empresas Whop.
- Portal de payout embebido.
- Eliminar los adaptadores anteriores.
- Cambiar en esta migración el sistema actual de reintentos de Web Push; el transactional outbox queda como mejora separada.

## Criterio de aceptación

Con una cuenta de prueba del creador y otra del fan: crear primero la cuenta TipMe sin Whop, comprobar que los pagos están bloqueados, instalar luego TipMe en Whop, vincular `biz_...`, habilitar los tips, enviar uno, recibir la confirmación mediante webhook, ver saldo/recibo sin refrescar y recibir el push. El dinero debe quedar disponible exclusivamente en la cuenta Whop del creador.
