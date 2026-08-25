# TipMe: PayPal centralizado con Payouts

**Fecha:** 2026-08-20

## Objetivo

Permitir que TipMe salga al piloto sin esperar la aprobación de PayPal Multiparty. El fan paga a la cuenta Business de TipMe; un webhook verificado confirma el tip; el ledger calcula el saldo neto de la persona creadora; y TipMe envía el retiro automáticamente a su cuenta personal de PayPal mediante la API de Payouts.

Este modo no afirma que el dinero vaya directamente del fan a la persona creadora. El flujo real es:

```text
fan -> PayPal de TipMe -> webhook -> ledger -> PayPal Payouts -> PayPal de la persona creadora
```

La integración Multiparty existente se conserva desactivada para poder retomarla cuando PayPal apruebe a TipMe como partner.

## Decisiones aprobadas

- `PAYPAL_FLOW=platform_payouts` selecciona globalmente el nuevo flujo.
- `PLATFORM_FEE_BPS=0`: TipMe no cobra comisión durante el piloto.
- Todo el MVP opera en USD.
- La persona creadora asume las comisiones reales de procesamiento de entrada y del payout.
- No hay límite fijo de retiro ni espera artificial después de confirmar el cobro.
- Los retiros pueden bloquearse únicamente por saldo insuficiente, saldo negativo, cuenta PayPal no configurada o rechazada, estado financiero en proceso o una suspensión administrativa auditada.
- El frontend nunca confirma dinero ni determina una comisión real.

## Modos PayPal

La selección del proveedor y la selección del flujo son conceptos diferentes:

```dotenv
PAYMENT_PROVIDER=paypal
PAYPAL_FLOW=platform_payouts
```

Los flujos admitidos serán:

- `platform_payouts`: TipMe cobra como comercio único y distribuye mediante Payouts.
- `multiparty`: conserva el comportamiento de pago directo existente, pero solo se habilitará cuando TipMe tenga aprobación de partner y las capacidades necesarias.

Los registros históricos conservan sus identificadores y proveedor originales. Cambiar la variable no reinterpreta ni migra movimientos financieros anteriores.

## Configuración de la cuenta creadora

### Experiencia

El onboarding y los ajustes muestran un único campo `Correo de tu cuenta PayPal`:

1. La persona escribe una vez el correo que usa en PayPal.
2. El servidor normaliza y valida su formato.
3. TipMe guarda el correo como destino `EMAIL` con estado `pending` y muestra `PayPal configurado`.
4. La persona puede completar el onboarding y solicitar su primer retiro.
5. PayPal valida realmente el destino al procesar ese primer payout.
6. Un payout `SUCCESS` cambia la cuenta a `verified` y muestra `PayPal confirmado`.

No se afirma que el correo esté asociado a PayPal antes del primer payout exitoso. Si PayPal devuelve `UNCLAIMED`, TipMe solicita cancelar el ítem, conserva la reserva hasta que PayPal confirme la cancelación o devolución y después pide corregir el correo.

La interfaz muestra el correo enmascarado después de guardarlo y permite reemplazarlo. Cambiar el correo vuelve a dejar la cuenta en estado `pending`.

### Seguridad y estados

- TipMe no solicita ni almacena contraseña, banco, tarjeta, documento de identidad ni token de acceso de la persona.
- El correo se valida server-side, se normaliza en minúsculas y se protege con RLS.
- Una cuenta `pending` puede realizar únicamente el payout que servirá para comprobarla; una cuenta `rejected` no puede retirar.
- La cuenta queda `verified` exclusivamente después de que PayPal confirme un payout exitoso a ese destino.
- La UI advierte que la persona debe revisar el correo antes de guardar porque PayPal no ofrece una consulta previa para validar una cuenta arbitraria.

En Sandbox, las pruebas automáticas o administrativas exitosas utilizan `PAYPAL_SANDBOX_PAYOUT_RECIPIENT_ID` con `recipient_type: PAYPAL_ID`. Los correos ficticios `@personal.example.com` se usan para probar `UNCLAIMED`, no como prueba de éxito.

## Cobro del fan

El checkout actual permanece embebido y cobra a la cuenta PayPal Business de TipMe. En `platform_payouts`, la orden no contiene payee de una persona creadora, `PayPal-Auth-Assertion` ni `platform_fees` de Multiparty.

El flujo es:

1. El servidor valida username, monto, anonimato, nombre y mensaje.
2. Inserta un tip `created` y crea una orden PayPal USD idempotente.
3. El fan autoriza y el backend solicita la captura.
4. La captura del navegador solo deja el tip pendiente de confirmación.
5. El webhook PayPal se verifica contra la API oficial.
6. `PAYMENT.CAPTURE.COMPLETED` correlaciona la captura con el tip y obtiene `seller_receivable_breakdown` cuando esté disponible.
7. Una transacción de base de datos confirma el tip, escribe el ledger y crea una única notificación lógica.
8. Realtime actualiza el dashboard y Web Push notifica a todos los dispositivos activos.

El checkbox opcional del fan se presenta como `Añadir un aporte para cubrir el procesamiento`. Cuando se activa, el servidor calcula un aporte estimado con una tasa y una comisión fija configurables; el navegador no envía el valor calculado como fuente confiable. No se promete que la persona creadora recibirá exactamente el importe base porque PayPal determina la comisión real después de procesar el pago. El comprobante distingue tip base, aporte de procesamiento, total pagado y neto registrado.

## Comisiones y ledger

Nunca se inventa una comisión real. Al confirmar una captura:

- `base_amount_minor` conserva el tip elegido antes del aporte opcional.
- `processing_support_minor` conserva el aporte opcional calculado server-side.
- `amount_minor = base_amount_minor + processing_support_minor` conserva el total cobrado al fan.
- `platform_fee_minor` es cero durante el piloto.
- `gateway_fee_minor` usa exclusivamente la comisión real informada por PayPal.
- `net_amount_minor = amount_minor - platform_fee_minor - gateway_fee_minor`.

En `platform_payouts`, si el evento de captura completada no incluye la comisión, el backend consulta el detalle de la captura. Mientras no pueda obtenerla, el tip permanece pendiente de conciliación: no escribe ledger, no aumenta saldo y no envía el push de dinero recibido. Un reintento controlado completa la confirmación cuando PayPal entrega el desglose. Esto evita acreditar el bruto como si fuera neto.

El ledger escribe entradas inmutables:

- `tip_confirmed`: importe bruto positivo.
- `gateway_fee`: comisión de procesamiento negativa.
- `platform_fee`: se omite cuando su importe es cero.
- `reserve_hold` y `reserve_release`: controlan un retiro en proceso.
- `payout`: salida definitiva.
- `refund` y `chargeback`: reversiones posteriores.

Ejemplo observado en Sandbox:

```text
Tip pagado                 $20.00
Procesamiento PayPal       -$1.61
TipMe                       $0.00
Saldo neto                 $18.39
```

## Solicitud y envío de un retiro

La pantalla de retiros muestra saldo disponible, comisión estimada de Payouts y monto que recibirá la persona. No hay límite máximo adicional al saldo disponible.

La comisión estimada se configura, no se hardcodea:

```dotenv
PAYPAL_PAYOUT_FEE_BPS=200
PAYPAL_PAYOUT_FEE_CAP_MINOR=100
PAYOUT_HOLD_MINUTES=0
```

Estos valores representan la tarifa observada y publicada al diseñar el piloto: 2% y tope de USD 1 por payout para el mercado aplicable. La respuesta real de PayPal prevalece y se almacena como comisión definitiva.

Al solicitar el retiro:

1. Una función transaccional bloquea las filas financieras necesarias.
2. Reconstruye el saldo disponible desde el ledger.
3. Rechaza saldo negativo, monto inválido, cuenta sin correo o rechazada, o retiro superior al disponible; `pending` se permite para validar el primer payout.
4. Calcula conservadoramente cuánto puede enviarse sin requerir fondos propios de TipMe para la comisión.
5. Crea el payout y una reserva atómica para impedir retiros simultáneos.
6. Envía a PayPal un `sender_batch_id` derivado del UUID del payout y `recipient_type: EMAIL`.

En Sandbox, el override administrativo de Account ID cambia únicamente el destinatario de prueba a `recipient_type: PAYPAL_ID`; nunca está disponible desde el navegador ni en Live.

El monto enviado más la reserva estimada para la comisión nunca supera el saldo de la persona. Cuando PayPal devuelve la comisión real, el ledger concilia cualquier diferencia de centavos; el remanente vuelve a estar disponible.

La prueba Sandbox existente confirmó un payout de USD 1 al Account ID con estado `SUCCESS` y una comisión de USD 0.02.

## Estados de Payouts

El endpoint de webhooks procesa los eventos de lote y, principalmente, los eventos por ítem:

- `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`: finaliza el payout, registra comisión y salida, libera el exceso reservado y envía `Retiro completado`.
- `PAYMENT.PAYOUTS-ITEM.FAILED`, `RETURNED`, `CANCELED` o `REFUNDED`: libera el saldo que ya no esté en poder de PayPal y crea una notificación segura.
- `PAYMENT.PAYOUTS-ITEM.UNCLAIMED`: solicita la cancelación del ítem; conserva la reserva hasta que PayPal confirme `CANCELED` o `RETURNED`.
- `PAYMENT.PAYOUTS-ITEM.HELD` o estados de procesamiento: conserva la reserva hasta alcanzar un estado final; nunca muestra el retiro como completado.
- Eventos de lote sirven para seguimiento, pero el backend consulta el detalle por ítem antes de mover dinero porque el evento de lote no contiene toda la información del destinatario.

Los webhooks se verifican con la firma de PayPal y se deduplican mediante `(provider, provider_event_id)`. Los reintentos de la API usan el mismo identificador idempotente. Un evento duplicado no crea otro payout, movimiento, notificación ni push.

## Reembolsos, contracargos y liquidez

Un reembolso devuelve al fan el importe correspondiente, mientras la comisión original de recepción puede no devolverse. Si la persona creadora ya retiró, la reversión puede dejar su ledger negativo. En ese caso:

- se bloquean nuevos retiros de esa persona;
- futuros tips compensan primero el saldo negativo;
- se conserva toda la trazabilidad;
- una acción administrativa sensible requiere motivo y auditoría.

El ledger de otra persona nunca se modifica para cubrir la deuda. Sin embargo, PayPal mantiene físicamente un saldo común en la cuenta de TipMe: una controversia puede reducir esa liquidez aunque la separación contable sea correcta. El propietario acepta este riesgo para un piloto pequeño sin reserva inicial. La aplicación no promete disponibilidad instantánea cuando PayPal mantenga fondos en revisión o cuando el saldo real de la cuenta TipMe sea insuficiente.

No se establece un límite fijo de retiro. Puede añadirse posteriormente un umbral configurable de revisión sin convertirlo en un rechazo automático.

## Datos y migración

Se reutiliza `payout_accounts` para el destino de Payouts y se conserva `payment_accounts` para el Multiparty histórico:

- `payout_accounts.provider = paypal`;
- `provider_account_id`: correo PayPal normalizado;
- referencia enmascarada para interfaz;
- estado de conexión y verificación;
- timestamps de conexión y actualización.

`tips` incorpora `base_amount_minor` y `processing_support_minor` con checks que exigen que ambos reconstruyan `amount_minor`. Los registros existentes se migran con `base_amount_minor = amount_minor` y `processing_support_minor = 0`.

`payouts` debe representar por separado:

- importe debitado del saldo de la persona;
- importe enviado al destinatario;
- comisión estimada y comisión real;
- ID de lote e ID de ítem PayPal;
- estado normalizado y estado original del proveedor;
- timestamps de solicitud, procesamiento y finalización.

Los campos nuevos tendrán checks de unidades menores no negativas, claves foráneas, índices para correlación y restricciones únicas sobre IDs PayPal cuando existan. RLS permite a cada persona leer únicamente sus cuentas y retiros; solo código server-side confiable cambia identificadores, verificación o estados financieros.

Las migraciones son aditivas y no eliminan datos demo, tips, cuentas Multiparty ni retiros anteriores.

## Errores y observabilidad

- Errores al guardar o procesar el destino se muestran sin exponer respuestas sensibles de PayPal.
- Fondos PayPal insuficientes dejan el payout fallido o pendiente de reintento controlado y restauran el saldo solo cuando PayPal confirma que no salió dinero.
- Una tarifa diferente a la estimada se concilia con la respuesta real; si no hay margen suficiente, no se completa un envío mayor al dinero disponible.
- Estados desconocidos se registran para revisión y no mueven el ledger.
- Los logs incluyen timestamps de captura, llegada del webhook, confirmación, creación del payout, webhook de payout e intento de push.
- Secretos, cabeceras de autorización, correos completos y payloads sensibles se redactan.

## Variables de entorno

`.env.example` incluirá únicamente valores falsos:

```dotenv
PAYMENT_PROVIDER=paypal
PAYPAL_FLOW=platform_payouts
PAYPAL_ENVIRONMENT=sandbox
NEXT_PUBLIC_PAYPAL_CLIENT_ID=fake-paypal-client-id-replace-me
PAYPAL_CLIENT_SECRET=fake-paypal-client-secret-replace-me
PAYPAL_WEBHOOK_ID=fake-paypal-webhook-id-replace-me
PAYPAL_SANDBOX_PAYOUT_RECIPIENT_ID=fake-sandbox-paypal-account-id
PLATFORM_FEE_BPS=0
PAYPAL_PAYOUT_FEE_BPS=200
PAYPAL_PAYOUT_FEE_CAP_MINOR=100
PAYPAL_CHECKOUT_FEE_BPS=540
PAYPAL_CHECKOUT_FIXED_FEE_MINOR=30
PAYOUT_HOLD_MINUTES=0
```

Las variables de checkout solo estiman el aporte voluntario antes de pagar; nunca sustituyen `seller_receivable_breakdown.paypal_fee`. Sus valores se revisan contra la tarifa aplicable antes de activar Live.

Las variables de Partner/MultiParty existentes permanecen documentadas pero no son obligatorias en `platform_payouts`. Solo el Client ID público puede exponerse al navegador. Todos los demás secretos pertenecen a `.env.local` y Vercel.

## Pruebas enfocadas

Para mantener pequeño el MVP se automatiza solo lo financiero y de seguridad crítico:

1. Correo válido se guarda normalizado; correo inválido se rechaza server-side.
2. El primer payout exitoso cambia la cuenta de `pending` a `verified`.
3. Captura confirmada registra una vez el bruto, la comisión real y el neto.
4. El servidor calcula el aporte opcional; el navegador no puede confirmar tips ni definir fees.
5. No se puede retirar más que el saldo disponible, considerando la comisión del payout.
6. Dos solicitudes concurrentes no gastan el mismo saldo.
7. Repetir el payout con el mismo ID no envía dinero dos veces.
8. `SUCCEEDED` finaliza ledger y crea una sola notificación y push lógico.
9. Un fallo final libera la reserva; `UNCLAIMED` solicita cancelación y no libera antes de `CANCELED` o `RETURNED`.
10. Refund o chargeback corrige el ledger, puede crear saldo negativo y bloquea retiros.
11. La persona A no puede leer ni cambiar cuenta, tip o payout de la persona B.
12. Mock y Multiparty continúan compilando y sus pruebas existentes no se rompen.

La verificación manual Sandbox cubre: guardar el correo PayPal, pagar un tip, recibir webhook y push, ver el neto, retirar todo lo disponible menos la comisión mediante el Account ID de prueba, recibir el payout y comprobar que un webhook duplicado no repite dinero ni push. También se prueba un correo ficticio `UNCLAIMED` y su cancelación.

Antes de desplegar se ejecutan pruebas enfocadas, suite completa, typecheck, lint y build de producción. La activación Live requiere comprobar en la cuenta real de TipMe que Payouts esté habilitado; que funcione en Sandbox no garantiza acceso Live. `Log in with PayPal` queda fuera de este piloto porque su activación Live requiere una revisión separada de PayPal.

## Criterios de aceptación

- Una persona configura su cuenta personal PayPal escribiendo un único correo.
- TipMe no declara verificado el correo hasta que PayPal complete el primer payout.
- El fan paga sin cuenta TipMe y el webhook sigue siendo la única fuente de confirmación.
- El saldo muestra únicamente el neto real de procesamiento conocido.
- La persona puede solicitar todo su saldo disponible sin límite fijo.
- El payout reserva fondos, descuenta su comisión, usa `EMAIL` en Live y termina según webhooks verificados.
- Un payout duplicado no duplica dinero ni notificaciones.
- Fallos y estados intermedios no liberan o descuentan saldo incorrectamente.
- Reembolsos y contracargos mantienen trazabilidad y bloquean retiros cuando crean deuda.
- TipMe cobra 0% y nunca necesita aportar dinero propio para la comisión normal del payout.
- Multiparty queda intacto, configurable y desactivado durante el piloto.
