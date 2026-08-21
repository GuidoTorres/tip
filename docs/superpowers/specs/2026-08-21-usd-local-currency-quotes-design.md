# TipMe: tips en USD con cobro local mediante Mercado Pago

## Objetivo

El fan elige un importe universal expresado en USD. TipMe convierte ese importe a la moneda local de la cuenta Mercado Pago del creador y Mercado Pago procesa el cobro local. El dashboard, ledger, saldos y retiros muestran exclusivamente la moneda local realmente recibida.

## Experiencia

- Los importes públicos son US$5, US$10, US$20, US$50 y otro importe en USD.
- El fan no elige país, moneda ni tasa de cambio.
- Antes del formulario de tarjeta se muestra una nota breve: el cobro se procesará por el equivalente en la moneda de la cuenta receptora y el banco del fan puede aplicar su propia conversión.
- El detalle y comprobante conservan la referencia USD, pero muestran también el monto local efectivamente cobrado.
- El dashboard muestra importes reales en la moneda local de Mercado Pago.

## Cotización segura

1. El cliente solicita una cotización indicando username e importe USD en unidades menores.
2. El backend localiza la cuenta Mercado Pago conectada y obtiene su token OAuth server-side.
3. El backend consulta `GET /v1/exchange_rates?from=USD&to=<moneda local>` con el token del vendedor.
4. Convierte respetando la cantidad ISO de decimales de la moneda y crea un token HMAC firmado, con separación de dominio y vencimiento de 10 minutos.
5. El cliente recibe únicamente importe local, moneda, fecha y token de cotización.
6. Al pagar, el backend verifica firma, vencimiento, creador e importe USD y usa exclusivamente el importe local firmado. Nunca confía en una tasa o monto local enviados libremente por el navegador.

Si la moneda local es USD, la tasa es 1 y no se consulta conversión. Si Mercado Pago no devuelve una cotización válida, el pago falla cerrado con un mensaje comprensible.

## Persistencia y contabilidad

Se añaden a `tips`:

- `display_amount_usd_minor bigint`
- `exchange_rate numeric(20,10)`
- `exchange_rate_quoted_at timestamptz`
- `exchange_rate_source text`

Los campos financieros existentes mantienen este significado:

- `base_amount_minor`, `amount_minor`, `platform_fee_minor`, `gateway_fee_minor` y `net_amount_minor`: moneda local cobrada.
- `currency`: moneda local de la cuenta Mercado Pago.

El 1% de TipMe se calcula sobre el monto local. El webhook continúa validando monto local, moneda local, vendedor, comisión e identificadores. El ledger solo registra moneda local, de modo que saldos y retiros siguen siendo reconstruibles sin conversiones posteriores.

## Componentes

- Cliente de cotización Mercado Pago aislado del proveedor de cobro.
- Endpoint rate-limited para emitir cotizaciones firmadas.
- Utilidad server-side para firmar y verificar cotizaciones reutilizando el secreto de recibos con separación de dominio.
- Formulario público que mantiene USD como importe de intención y entrega el monto local al Card Payment Brick.
- Flujo `createTip` que valida el token y persiste ambos importes.
- Migración aditiva compatible con tips históricos; las nuevas columnas son nullable para preservar el historial anterior.

## Errores y seguridad

- Cotización inválida, vencida o manipulada: HTTP 400, sin crear cobro.
- Servicio de cambio no disponible: no se cobra ni se reutiliza una tasa indefinidamente.
- Los tokens OAuth, claves HMAC y respuestas completas del proveedor nunca llegan al navegador ni se registran.
- El frontend nunca decide la moneda local, tasa, comisión ni confirmación del pago.
- La cotización no confirma un pago; el webhook verificado sigue siendo la única fuente de confirmación.

## Pruebas

- Conversión y redondeo de acuerdo con los decimales ISO de cada moneda admitida.
- Token válido, vencido, manipulado y perteneciente a otro creador o importe.
- El cobro usa el importe local firmado, no valores del navegador.
- Comisión calculada sobre el monto local.
- Persistencia de USD, tasa, moneda y monto local.
- Webhook confirma únicamente cuando monto y moneda locales coinciden.
- Dashboard y ledger permanecen en moneda local.
- Fallo de cotización no crea un pago.

## Fuera de alcance

- Liquidación real en USD.
- Garantizar el importe final convertido por el banco emisor del fan.
- Cobros Cross Border especiales de Mercado Pago.
- Historial o gráficos de fluctuación cambiaria.
