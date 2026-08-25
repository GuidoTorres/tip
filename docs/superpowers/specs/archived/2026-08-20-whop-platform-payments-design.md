# TipMe: pagos directos con Whop for Platforms

**Fecha:** 2026-08-20

## Objetivo

Integrar Whop como proveedor principal para que cada persona creadora opere mediante una connected account, reciba direct charges y gestione sus retiros con Whop. TipMe conserva su experiencia pública, ledger, recibos, Realtime y Web Push, pero nunca recibe ni distribuye manualmente los fondos.

El flujo aprobado es:

```text
fan -> checkout Whop -> connected account del creador
                    -> webhook verificado -> TipMe ledger -> Realtime + push
connected account -> portal Whop -> retiro del creador
```

PayPal y Mock permanecen como adaptadores desactivados. Los datos históricos no se migran ni reinterpretan.

## Decisiones aprobadas

- `PAYMENT_PROVIDER=whop` activa el nuevo adaptador.
- Todo el piloto opera en USD y TipMe almacena dinero únicamente en unidades menores.
- `PLATFORM_FEE_BPS=100`: TipMe cobra 1% mediante `application_fee_amount`.
- El pago es un direct charge de la connected account; TipMe no custodia fondos.
- La connected account asume el procesamiento de Whop, devoluciones y disputas.
- El fan puede ayudar voluntariamente con una estimación del procesamiento, sin promesa de que cubra exactamente el fee final.
- El webhook, nunca el navegador ni `onComplete`, confirma el tip y mueve el ledger.
- Sandbox sirve para checkout con tarjeta y webhooks. KYC, payouts y wallets se validan manualmente en producción con importes pequeños porque no están completamente disponibles en sandbox.
- La activación en producción sigue condicionada a que Whop habilite Platforms y acepte el modelo comercial.

## Alternativas descartadas

### Cobrar en TipMe y transferir después

TipMe sería responsable del dinero, liquidez, disputas y distribución. Contradice el objetivo de no custodiar fondos y añade riesgo operativo innecesario.

### Enviar a checkout Whop de una sola cuenta

Permitiría probar tarjetas, pero TipMe sería el comercio único y no demostraría connected accounts ni retiros de creadores. No representa el modelo final.

### Binance Pay como proveedor principal

Una cuenta personal no ofrece a TipMe webhooks y correlación suficientes. Merchant, Onchain Pay y subcomercios requieren acceso empresarial adicional y no resuelven de forma inmediata el onboarding de personas individuales.

## Configuración y secretos

Se añaden variables server-side con valores falsos en `.env.example`:

```dotenv
PAYMENT_PROVIDER=whop
PLATFORM_FEE_BPS=100
WHOP_ENVIRONMENT=sandbox
WHOP_API_KEY=whop_fake_replace_me
WHOP_PLATFORM_COMPANY_ID=biz_fake_replace_me
WHOP_WEBHOOK_SECRET=whsec_fake_replace_me
```

La API key y el secreto de webhook nunca usan el prefijo `NEXT_PUBLIC_`. El cliente recibe solamente identificadores temporales de checkout y el nombre del entorno. Sandbox usa `https://sandbox-api.whop.com/api/v1`; producción usa la URL predeterminada del SDK.

## Connected accounts y onboarding

`payment_accounts` sigue siendo la tabla de identidades financieras externas. Una migración amplía el constraint del proveedor para aceptar `whop`; `provider_merchant_id` guarda el ID `biz_...` de la connected account. No se guardan documentos KYC, cuentas bancarias ni secretos de la persona creadora.

El onboarding financiero hace lo siguiente:

1. Autentica a la persona con Supabase.
2. Reutiliza su connected account si ya existe; nunca crea dos por reintentos.
3. Crea la company hija con `parent_company_id`, correo, nombre visible y metadata controlada con el UUID interno.
4. Guarda primero el `biz_...` en estado `pending`.
5. Crea un account link de Whop con callbacks a TipMe y abre el onboarding alojado.
6. Al regresar, el servidor consulta o espera evidencia verificable de Whop; el parámetro de retorno del navegador no marca la cuenta como conectada por sí solo.
7. `verification.succeeded` y los estados de payout account actualizan la capacidad financiera. Estados restringidos bloquean nuevos checkouts.

En sandbox, donde el flujo completo de payouts no está disponible, la cuenta hija puede marcarse lista solo para checkout de prueba. Esta excepción se deriva exclusivamente de `WHOP_ENVIRONMENT=sandbox` y no puede activarse en producción.

## Creación y presentación del checkout

El adaptador oficial usa `@whop/sdk` server-side y `@whop/checkout` para el iframe. Son las únicas dependencias nuevas.

El checkout no se crea al cargar el perfil público. Cuando el fan valida el formulario y pulsa continuar:

1. El backend valida username, monto, nombre, mensaje, términos y aporte de procesamiento.
2. Comprueba que el creador tenga una connected account apta.
3. Inserta el tip `created` con importes en minor units.
4. Calcula el 1% con `PLATFORM_FEE_BPS`; para USD 20 son 20 centavos.
5. Crea una checkout configuration idempotente sobre el `company_id` del creador, con plan `one_time`, precio USD, `application_fee_amount` y metadata mínima (`tip_id`).
6. Guarda el ID `ch_...` como `provider_payment_id` y devuelve al navegador `sessionId`, `planId` y entorno.
7. El iframe muestra los métodos habilitados por Whop. Su callback visual puede cambiar la pantalla, pero no confirmar dinero.

La experiencia será de dos fases dentro de la misma página: datos del tip y luego checkout seguro. No se abre una pestaña externa salvo que un método de pago lo requiera. El resultado definitivo se consulta desde el servidor y conduce al comprobante existente.

La conversión entre minor units y el decimal exigido por Whop ocurre solo en el borde del adaptador, con dos decimales exactos para USD. La base de datos y el dominio nunca almacenan floats.

## Comisiones

Whop publica una tarifa base de tarjeta de 2.7% + USD 0.30, con recargos posibles para tarjeta internacional y conversión. Estos valores solo sirven para estimar el aporte voluntario del fan. La comisión real proviene del Payment de Whop después del cobro.

Al confirmar:

- `base_amount_minor`: tip seleccionado por el fan;
- `processing_support_minor`: aporte estimado opcional;
- `amount_minor`: total cobrado;
- `platform_fee_minor`: 1% del tip base, calculado server-side y enviado como application fee;
- `gateway_fee_minor`: fee real derivado del Payment autoritativo de Whop;
- `net_amount_minor`: total menos fee de TipMe y fee real de Whop.

Si Whop todavía no entrega datos suficientes para reconstruir el fee, el tip permanece pendiente de conciliación y no genera saldo ni push. Nunca se inventa un fee definitivo.

## Webhooks, correlación e idempotencia

El endpoint será `POST /api/webhooks/whop`. Se usará el body crudo y `whopsdk.webhooks.unwrap` con el secreto configurado. Una firma inválida devuelve 401 y no escribe nada.

El webhook de la company padre debe incluir eventos de child resources. Los eventos iniciales son:

- `payment.succeeded`, `payment.pending`, `payment.failed`;
- `refund.created`, `refund.updated`;
- `dispute.created`, `dispute.updated`;
- `verification.succeeded`;
- `payout_account.status_updated`;
- `withdrawal.created`, `withdrawal.updated`.

Un Payment se correlaciona por `checkout_configuration_id = tips.provider_payment_id`; su `pay_...` se guarda como `provider_capture_id`. La metadata `tip_id` se valida como defensa adicional. Antes de confirmar, el backend consulta el Payment actual cuando el evento no contiene todos los importes.

Whop entrega webhooks al menos una vez y sin orden garantizado. `webhook-id` se registra como deduplicador de entrega y los IDs estables de Payment, Refund, Dispute y Withdrawal impiden efectos financieros repetidos entre distintos tipos de evento. Un duplicado no repite ledger, notificación ni push.

Los estados terminales se aplican solamente cuando el recurso autoritativo de Whop lo confirma. Reembolsos parciales se registran por su importe real y nunca revierten automáticamente el tip completo. Una disputa reserva el importe afectado; perderla crea `chargeback` y ganarla libera la reserva. Si un esquema o estado no está reconocido, el evento se registra para administración sin mover dinero.

## Ledger, balance y retiros

El ledger de TipMe es un espejo auditable de los eventos del proveedor, no una wallet. El dashboard muestra ingresos netos confirmados y el saldo reflejado por eventos de Whop. La pantalla de retiros deja claro que Whop mantiene y paga los fondos.

El creador abre el portal de payouts alojado o embebido usando un access token temporal emitido server-side para su propia connected account. Allí completa KYC, configura el método y solicita el retiro. TipMe nunca recibe datos bancarios.

Los eventos de Withdrawal crean o actualizan un payout local correlacionado con el ID de Whop:

- al iniciarse, reservan el importe una sola vez;
- al completarse, registran la salida, liberan la reserva y crean una notificación/push;
- al fallar, liberan la reserva y crean una única notificación/push;
- estados desconocidos no alteran el saldo.

El balance mostrado por el portal de Whop es la fuente autoritativa para retirar. Si el espejo local se retrasa, TipMe lo identifica como información en actualización y no promete disponibilidad distinta a la que Whop permita.

## Texto legal y contenido admitido

El checkbox público deja de decir simplemente “no es una compra”. Indicará que el tip reconoce o apoya contenido digital legítimo de la persona creadora y que no es una remesa, préstamo, reembolso ni donación benéfica.

Cada creador declara durante onboarding que ofrece contenido digital legítimo y que no usa TipMe para categorías prohibidas. TipMe conserva enlaces legales y una vía de reporte. Este texto no intenta eludir políticas: la activación Live queda sujeta a la revisión real de Whop.

## Errores y observabilidad

- Un creador sin connected account apta no puede recibir checkout y ve una acción para completar Whop.
- Un fallo de creación de company o checkout conserva un código seguro y permite reintentar sin duplicar recursos.
- `payment.pending` no genera push de dinero recibido.
- Un fallo o rechazo no genera ledger positivo.
- Los logs registran creación del checkout, llegada del webhook, confirmación financiera e intento de push con timestamps e IDs no sensibles.
- No se registran API keys, secretos, cabeceras completas, datos de tarjeta, direcciones bancarias ni payloads crudos con PII.

## Pruebas enfocadas

Para limitar código y tiempo se automatiza solamente lo crítico:

1. El factory selecciona Whop sin romper Mock y PayPal.
2. Crear una connected account es idempotente y pertenece al creador autenticado.
3. Un creador no conectado no puede generar checkout.
4. USD minor units, importe de checkout y application fee del 1% coinciden exactamente.
5. El navegador no puede confirmar el tip.
6. Firma inválida no crea eventos, saldo ni push.
7. `payment.succeeded` correlaciona, obtiene fees reales y confirma una sola vez.
8. Pending y failed no acreditan dinero.
9. Webhook repetido no duplica ledger ni push.
10. Refund parcial y chargeback afectan solo el importe confirmado por Whop.
11. La persona A no obtiene token de onboarding o payouts para la company de la persona B.
12. Withdrawal completado o fallido actualiza una sola vez y genera el push correcto.
13. El checkout embebido lleva al comprobante solo después de confirmación server-side.

La prueba manual en sandbox cubre connected account de prueba cuando esté disponible, tarjeta exitosa, rechazada y 3DS, webhook firmado, recibo, saldo, Realtime y push. La prueba manual Live posterior cubre KYC, Apple Pay/Google Pay, método de retiro y withdrawal con un monto pequeño.

Antes de entregar se ejecutan pruebas enfocadas, suite completa, typecheck, lint y build. Las pruebas de dispositivos reales y payouts Live se documentan como manuales; no se declara que pasaron hasta realizarlas realmente.

## Criterios de aceptación

- El onboarding crea o reutiliza una connected account y no almacena información financiera sensible.
- Un fan sin cuenta TipMe puede abrir checkout Whop para el creador correcto.
- TipMe calcula y cobra 1% server-side.
- Solo un webhook Whop válido confirma el tip.
- Ledger, saldo, recibo, Realtime y push conservan idempotencia.
- El creador gestiona KYC y retiros con Whop; TipMe no custodia fondos.
- Refunds, disputas y withdrawals desconocidos fallan de forma conservadora.
- Mock y PayPal siguen compilando y pueden reactivarse por configuración.
- `.env.example` contiene solo credenciales falsas y README explica sandbox, producción y limitaciones.
