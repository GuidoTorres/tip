# TipMe: conexión PayPal directa para creadores

## Objetivo

La persona creadora conecta una cuenta PayPal mediante el onboarding oficial para plataformas. Los tips confirmados se envían directamente a esa cuenta y TipMe registra su comisión, estado y trazabilidad. TipMe no presenta un saldo Sandbox como retirable ni simula retiros.

## Onboarding

1. El paso de cobros muestra `Conectar PayPal`.
2. PayPal autentica a la persona y obtiene su consentimiento fuera de TipMe.
3. PayPal regresa a TipMe por el callback configurado.
4. El backend consulta el estado del comercio y guarda únicamente el Merchant ID y estados de habilitación.
5. El onboarding continúa solo cuando la cuenta puede recibir pagos.

No se enlazan tarjetas bancarias a TipMe. PayPal administra los datos financieros, bancos y tarjetas de la persona creadora.

## Pagos

- Un fan puede pagar con tarjeta mediante Card Fields cuando PayPal lo habilite, sin cuenta de fan en TipMe.
- La orden identifica como beneficiaria a la cuenta PayPal conectada.
- PayPal aplica la comisión de plataforma configurada cuando TipMe tenga habilitada la capacidad `PARTNER_FEE`.
- El webhook verificado sigue siendo la única fuente para confirmar el tip, escribir ledger y enviar notificaciones.

## Panel de dinero

- La ruta `/dashboard/payouts` permanece por compatibilidad de navegación, pero muestra `Método de cobro` y el estado de la cuenta PayPal.
- Se elimina `ABRIR PAYPAL SANDBOX`.
- No se muestra `RETIRAR AHORA`, porque el dinero ya fue enviado a PayPal y TipMe no lo custodia.
- Se muestran el neto confirmado, pendiente y el historial de tips.
- Si la cuenta no está conectada, se muestra `Conectar PayPal`.

## Modos y errores

- No se expone ninguna acción de simulación en modo PayPal.
- Si PayPal no autoriza Partner Referrals o `PARTNER_FEE`, la interfaz informa que la conexión todavía no está disponible y no acepta tips para esa persona.
- La activación real depende de la aprobación de TipMe como plataforma PayPal; no se sustituye con datos falsos.

## Seguridad

- TipMe no almacena credenciales, contraseñas, números de tarjeta ni datos bancarios completos.
- Los secretos y permisos de plataforma permanecen server-side.
- El estado `connected` se obtiene desde PayPal y nunca desde parámetros confiados al navegador.

## Verificación

- Una cuenta no conectada no puede recibir tips PayPal.
- El onboarding usa Partner Referrals y valida el callback.
- Una cuenta conectada muestra estado de cobro dentro de TipMe sin botón Sandbox.
- El modo PayPal no ofrece retiros simulados.
- Las pruebas de pagos, webhook, ledger y push continúan pasando.
