# TipMe: checkout PayPal en una sola pantalla

Fecha: 2026-08-20

## Objetivo

Permitir que el fan complete los datos del tip y la tarjeta en una sola pantalla, con un único clic final en **ENVIAR TIP**. PayPal seguirá disponible como alternativa directa. Ningún flujo del navegador podrá confirmar el pago ni modificar el saldo.

## Experiencia

La página pública mostrará, en este orden:

1. monto en USD;
2. nombre opcional;
3. mensaje opcional compacto;
4. aporte voluntario para cubrir el procesamiento;
5. aceptación de términos;
6. campos seguros de tarjeta;
7. botón **ENVIAR TIP**;
8. separador “O paga con” y botón oficial de PayPal.

Se elimina el selector “Enviar anónimamente”. Un nombre vacío se normaliza server-side como `payer_name = null` y `anonymous = true`; un nombre presente produce `anonymous = false`. El mensaje conserva el máximo de 280 caracteres, pero su caja visual será más baja.

## Arquitectura

### Preparación del checkout

La página solicitará a un endpoint PayPal rate-limited una configuración temporal para cargar los campos alojados. La respuesta podrá contener el Client ID público, Merchant ID cuando corresponda, BN code cuando corresponda y un client token temporal. Nunca contendrá Client Secret, access token ni ninguna credencial persistente.

Solicitar esta configuración no crea un tip, una orden PayPal ni un movimiento financiero.

### Creación tardía de la orden

El componente de checkout recibirá una función que obtiene los valores actuales del formulario. Cuando PayPal invoque `createOrder`, el navegador enviará esos valores a `POST /api/tips`. El backend validará los datos, creará el tip en estado `created` y creará la orden PayPal. El callback devolverá únicamente el ID de orden requerido por el SDK.

El botón de tarjeta llamará a `CardFields.submit()`. El botón oficial de PayPal usará el mismo callback `createOrder`. Por tanto, ambas opciones comparten las reglas de montos, aceptación legal, comisión voluntaria y persistencia.

### Confirmación

Después de la aprobación del pagador, el componente llamará al endpoint de captura existente con el `tipId` y el receipt token vinculados a la orden. El servidor consultará/capturará con PayPal y procesará el resultado mediante el flujo financiero existente. La interfaz esperará el estado confirmado mediante el endpoint protegido y solo entonces abrirá el comprobante.

La fuente de verdad continúa siendo:

PayPal → captura/webhook verificado → tip confirmado → ledger → saldo → notificación interna → push.

## Prevención de duplicados

Durante un intento activo, el componente conservará y reutilizará la misma promesa de creación y la misma orden. Los controles se deshabilitarán mientras se crea, confirma o captura el pago. Un fallo anterior a la creación permitirá reintentar. Si la orden ya fue creada, un reintento compatible reutilizará esa orden en lugar de crear otro tip.

El backend mantiene la idempotencia de captura y webhook existente; ningún `onApprove` del navegador acredita saldo directamente.

## Modos de proveedor

El checkout de una pantalla se aplica al proveedor PayPal embebido. El proveedor mock conserva su redirección y simulador existentes. La abstracción `PaymentProvider` no se sustituye ni se acopla a componentes de PayPal.

## Estados y errores

- Mientras carga PayPal, se muestra una preparación compacta sin habilitar el pago.
- Si la tarjeta no es elegible, se ocultan sus campos y PayPal queda como opción principal.
- Si PayPal Wallet no es elegible, no se muestra un contenedor vacío.
- Si falla la configuración, se ofrece reintentar sin crear un tip.
- Los pagos rechazados o cancelados no generan ledger, saldo ni push.
- Una confirmación demorada conduce al comprobante pendiente, que continúa consultando al servidor.

## Pruebas

Se cubrirá como mínimo:

1. la pantalla inicial contiene los tres campos de tarjeta y no crea un tip al renderizarse;
2. nombre vacío se envía como anónimo y nombre presente no;
3. ya no aparece el selector de anonimato;
4. el mensaje usa una altura compacta;
5. tarjeta y PayPal usan la misma función server-side para crear la orden;
6. un intento concurrente no crea dos órdenes;
7. el botón PayPal aparece como alternativa cuando es elegible;
8. el frontend no puede confirmar el tip;
9. rechazo, cancelación y fallo no acreditan dinero;
10. el flujo mock continúa funcionando.

La entrega exige typecheck, lint, suite completa y build de producción sin errores.
