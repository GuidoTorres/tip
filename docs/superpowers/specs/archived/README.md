# Diseños archivados — PayPal y Whop

Estos documentos describen integraciones que **ya no forman parte de TipMe**. Se conservan
como registro de la investigación, no como guía de implementación.

## Por qué se descartó PayPal

Se probaron los dos modelos que ofrece PayPal y ambos quedaron bloqueados desde Perú:

- **Multiparty / creador directo** (`PARTNER_FEE`, Partner Referrals): requiere que TipMe sea
  aprobada como plataforma del PayPal Commerce Platform. El propio spec lo dejaba anotado:
  *"La activación real depende de la aprobación de TipMe como plataforma PayPal"*. Ese programa
  no está abierto a plataformas registradas en Perú.
- **Platform payouts** (TipMe cobra y luego paga al creador): funciona sin aprobación, pero los
  retiros desde PayPal a un banco peruano son lentos, y el modelo pone a TipMe en **custodia de
  dinero de terceros**, una postura regulatoria que el split de Mercado Pago evita por completo.

## Por qué se descartó Whop

Nunca se implementó. Solo existió como diseño en papel.

## Qué lo reemplaza

Mercado Pago con Split Payments (`application_fee`): el creador cobra directo, TipMe nunca
custodia el dinero, Perú está soportado de forma nativa (`PE`/`PEN`/`MPE`), y el precio
universal en USD ya se resuelve con `2026-08-21-usd-local-currency-quotes-design.md`.

## Nota sobre la base de datos

Las migraciones SQL de PayPal (`202608160002_paypal_payment_accounts.sql`,
`202608200001_paypal_platform_payouts.sql`) **siguen aplicadas y no se tocaron**. Una migración
ya ejecutada no se reescribe. Si algún día se quiere retirar esas columnas, va en una migración
nueva. `tests/database/migration-safety.test.ts` las sigue cubriendo.
