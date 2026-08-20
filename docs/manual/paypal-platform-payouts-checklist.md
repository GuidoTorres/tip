# PayPal Platform Payouts — prueba Sandbox

## Antes de probar

1. Aplica `supabase/migrations/202608200001_paypal_platform_payouts.sql` en Supabase SQL Editor una sola vez.
2. Reinicia Next.js después de cambiar `.env.local`.
3. Confirma estas variables sin compartir secretos:
   - `PAYMENT_PROVIDER=paypal`
   - `PAYPAL_FLOW=platform_payouts`
   - `PLATFORM_FEE_BPS=0`
   - `PAYPAL_ENVIRONMENT=sandbox`
   - `PAYPAL_SANDBOX_PAYOUT_RECIPIENT_ID` contiene el Account ID de la cuenta Personal Sandbox receptora.
4. El webhook de la app Sandbox debe apuntar a `https://tipme.pro/api/webhooks/payments` en Vercel o a un túnel HTTPS para desarrollo local.
5. Suscribe los eventos `PAYMENT.CAPTURE.*` usados por TipMe y los ocho eventos `PAYMENT.PAYOUTS-ITEM.*` enumerados en el README.

## Recorrido completo

1. Crea una cuenta creadora y completa el perfil.
2. En el paso PayPal escribe un correo con formato válido. Debe aparecer **PayPal configurado**, no verificado.
3. Desde incógnito abre el link público y envía un tip Sandbox.
4. Comprueba que el webhook confirma una sola vez el tip, registra el fee real, actualiza el saldo y envía push.
5. En `/dashboard/payouts`, solicita un retiro. El total debitado no puede superar el disponible.
6. Comprueba en la cuenta Personal Sandbox asociada al Account ID que llegó el importe enviado.
7. Espera `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` y verifica:
   - retiro `completed`;
   - destino **PayPal verificado**;
   - un `reserve_release`;
   - un `payout` por el importe enviado;
   - un `gateway_fee` por el fee real;
   - una sola notificación interna y un push.
8. Reenvía el mismo webhook desde PayPal. No debe cambiar saldo ni duplicar notificación.

## Casos de fallo mínimos

- Intentar retirar más del disponible: debe rechazarse antes de PayPal.
- Payout 4xx definitivo: debe liberar la reserva.
- Timeout o 5xx: debe conservar la reserva y mostrar el retiro en comprobación.
- `UNCLAIMED`: TipMe solicita cancelar y no libera hasta `CANCELED` o `RETURNED`.
- Un refund o chargeback del tip debe corregir únicamente el ledger de esa persona; puede dejar saldo negativo.

No pruebes Live hasta confirmar que Payouts está habilitado en la app Live y completar los datos legales y de soporte del operador.
