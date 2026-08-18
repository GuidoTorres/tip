# Checklist del piloto

La persona creadora debe completar sin explicación técnica:

- registrarse;
- definir nombre, username, foto y descripción;
- conectar su cuenta PayPal Sandbox (o configurar retiro mock cuando el provider sea mock);
- activar notificaciones;
- copiar su link o mostrar su QR;
- reconocer un tip confirmado;
- entender neto confirmado y pendiente;
- abrir PayPal para administrar su dinero.

Observa dónde duda, retrocede o pide ayuda. Registra el paso, dispositivo, texto que no entendió y resultado esperado. No añadas funcionalidades durante la prueba; corrige primero la fricción del recorrido crítico.

## Prueba PayPal Sandbox

1. Configura `PAYMENT_PROVIDER=paypal` y `PAYPAL_ENVIRONMENT=sandbox`.
2. Conecta una cuenta de vendedor Sandbox desde onboarding.
3. Desde incógnito u otro dispositivo abre el perfil público.
4. Envía un tip anónimo usando una tarjeta Sandbox y repite con el botón PayPal.
5. Comprueba que la aprobación del navegador muestra “confirmando”, no “confirmado”.
6. Comprueba que llega `PAYMENT.CAPTURE.COMPLETED` al webhook y que PayPal lo verifica.
7. Verifica una única entrada lógica de ledger/notificación y el push en un dispositivo real.
8. Reenvía el mismo webhook y confirma que no duplica dinero ni push.
9. Abre la notificación y verifica el detalle del tip.
10. Comprueba en la cuenta Sandbox de PayPal el pago y la comisión configurada.

Si todavía no existe aprobación Multiparty, activa `PAYPAL_SANDBOX_SINGLE_MERCHANT=true`, deja vacío el BN Code y sustituye los pasos de conexión real por la tarjeta visual “Cuenta de prueba conectada”. En esta variante comprueba el pago en la cuenta Business Sandbox de TipMe; no esperes una distribución real ni una comisión separada por PayPal.

También prueba pago rechazado, pendiente, tarjeta no elegible, webhook inválido, refund y reversal. No uses dinero real para este checklist.

## Criterio de aceptación

Un webhook duplicado no cambia el saldo ni crea otra notificación lógica. Un tip anónimo no revela identidad. El dashboard abierto se actualiza sin refresh manual. En modo PayPal, TipMe no presenta una falsa acción de retiro ni afirma conocer la disponibilidad bancaria del dinero.
