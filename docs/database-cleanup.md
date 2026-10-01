# Limpieza del esquema de pagos

## Auditoría del 1 de octubre de 2026

Se consultaron en modo de solo lectura el esquema público expuesto por PostgREST y conteos exactos de la base configurada en `.env.local`. No se descargaron credenciales ni datos personales. Esta inspección no permite enumerar todas las dependencias internas de PostgreSQL; la migración usa DROP sin CASCADE y una transacción para detenerse ante dependencias desconocidas.

| Objeto | Evidencia | Decisión |
| --- | --- | --- |
| `payment_account_credentials` | 0 filas; ningún lector/escritor en `src` | Eliminar tabla de OAuth retirado |
| `payment_accounts.provider_country`, `provider_currency` | 0 valores no nulos; exclusivo de Mercado Pago | Eliminar ambas columnas y sus restricciones |
| `tips.display_amount_usd_minor`, `exchange_rate`, `exchange_rate_quoted_at`, `exchange_rate_source` | 0 tips con conversión; consultas de recibos y escritura de nulos retiradas en este cambio | Eliminar cuatro columnas y sus restricciones |
| `payment_accounts` | 0 filas; usado por PayPal multiparty | Mantener; aceptar nuevas cuentas solo de PayPal |
| `payout_accounts` | 2 filas; destinos activos de retiro | Mantener |
| `tips` | 5 filas | Mantener todos los registros y valores financieros |
| `payouts`, `ledger_entries`, `webhook_events` | 0 filas en la auditoría; código activo depende de ellos | Mantener |
| Perfiles, moderación, aceptación de políticas | Leídos/escritos por perfil, administración y bloqueo explícito | Mantener; pendiente ya no exige aprobación |
| Notificaciones y suscripciones push | Entrega de avisos de tips y retiros | Mantener |
| `admin_audit_logs` | Trazabilidad de decisiones administrativas | Mantener |

También se mantienen monedas históricas, identificadores de proveedor, `bank_name`, `last4`, `country` y RPCs de retiros: hay lectores o funciones SQL que dependen de ellos. Que un campo esté vacío o una tabla tenga cero filas no demuestra que sea prescindible.

## Aplicación

1. Mantener un backup de la base. Aplicar antes las migraciones anteriores pendientes, en orden.
2. Ejecutar `node --env-file=.env.local scripts/audit-payment-schema.mjs` y confirmar el destino mediante la configuración local. El comando no modifica la base.
3. Desplegar esta versión de la aplicación y retirar instancias/versiones anteriores: ya no lee ni escribe las columnas de conversión. Es compatible con el esquema antes y después de la limpieza, siempre que no existan tips con conversión.
4. Ejecutar completo `supabase/migrations/202610010002_retired_payment_schema_cleanup.sql`.
5. Repetir la auditoría: tabla OAuth y seis columnas deben figurar como ausentes; deben preservarse los datos financieros y funcionar recibos, tips y retiros.

La migración vuelve a comprobar los datos bajo bloqueo antes de eliminar nada. Si hay credenciales, cuentas no PayPal o valores regionales/de conversión, aborta íntegramente con `cleanup_blocked`. No borrar esas filas para forzarla: requieren una decisión de archivo/migración. El límite de espera de bloqueo es de cinco segundos; un timeout permite reintentar en un momento sin operaciones concurrentes. Es seguro repetir la migración una vez completada.

## Reversión

Ejecutar `supabase/rollbacks/202610010002_retired_payment_schema_cleanup.sql` antes de restaurar la aplicación anterior. Restituye tabla vacía, columnas nulas, restricciones, trigger, RLS y permisos de credenciales. No necesita reconstruir datos eliminados porque la migración de ida rechaza todo contenido en esos objetos. Tampoco modifica tips, saldos, retiros ni cuentas PayPal. No ejecutar archivos de `rollbacks` como parte de la cadena normal de migraciones.

La limpieza no se ha ejecutado en la base remota como parte de esta auditoría.
