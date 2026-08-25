# TipMe: tarjeta directa con fallback de PayPal

## Objetivo

El fan debe intentar pagar primero con tarjeta, sin registrarse ni iniciar sesión en PayPal. La interfaz prioriza velocidad y no solicita datos que TipMe no necesite.

## Flujo aprobado

1. Después de pulsar `ENVIAR TIP`, TipMe crea la orden en el servidor.
2. Si PayPal Card Fields es elegible, se muestran únicamente número de tarjeta, vencimiento y CVV.
3. El nombre del titular no se solicita en TipMe.
4. El botón principal dice `Pagar con tarjeta`.
5. Si Card Fields no es elegible o no puede cargarse, TipMe cambia al checkout alternativo de PayPal.
6. Antes de abrirlo, se informa que PayPal podría solicitar inicio de sesión, teléfono, dirección u otros datos según país y controles de riesgo.

## Interfaz

- La tarjeta directa es la única opción visible inicialmente cuando está disponible.
- El botón PayPal no compite visualmente con la tarjeta directa.
- El fallback aparece solo cuando la opción directa no está disponible.
- No se promete que el fallback tendrá los mismos campos mínimos.
- Un error técnico no se presenta como rechazo de la tarjeta.

## Seguridad y pagos

- Los datos de tarjeta permanecen dentro de los campos alojados por PayPal; TipMe no recibe ni almacena número o CVV.
- El navegador nunca confirma el tip ni modifica el saldo.
- La captura ocurre en el backend y el tip solo se confirma mediante webhook verificado e idempotente.
- PayPal puede exigir 3D Secure u otra autenticación cuando el emisor o la regulación lo requieran.

## Alcance del piloto

Este comportamiento permite validar la experiencia en Sandbox. La disponibilidad de Card Fields en producción depende de la elegibilidad de la cuenta y país del comercio; el fallback evita dejar al fan sin una opción de pago, pero puede introducir más fricción.

## Verificación mínima

- Card Fields elegible: se muestran solo número, vencimiento y CVV.
- Card Fields no elegible: aparece el fallback con explicación previa.
- El botón PayPal no aparece mientras la tarjeta directa sea elegible.
- Los flujos aprobado, rechazado y pendiente conservan el procesamiento server-side existente.
