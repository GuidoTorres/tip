# TipMe: moneda operativa USD y lenguaje neutral

Fecha: 2026-08-16

## Objetivo

Simplificar el MVP internacional para que todas las operaciones nuevas de TipMe se expresen y procesen en dólares estadounidenses (USD), y asegurar que la experiencia no asuma el género de quien recibe tips.

## Moneda única del MVP

- USD será la única moneda operativa disponible para perfiles, tips, saldos y retiros nuevos.
- Los importes continuarán almacenándose en unidades menores: `amount_minor = 2000` representa USD 20.00.
- El selector de moneda se eliminará del onboarding y de configuración.
- La interfaz mostrará USD como moneda fija cuando sea útil aclararlo.
- El servidor no confiará en una moneda enviada por el navegador: asignará o exigirá USD al crear tips y solicitar retiros.
- La columna `currency` y el tipo monetario se conservarán en el dominio y la base de datos. Esto mantiene trazabilidad y permite ampliar monedas en el futuro sin reestructurar el ledger.
- Los registros financieros históricos no se convertirán ni se renombrarán. Cambiar el código de moneda sin un tipo de cambio real falsearía su valor.
- Los perfiles existentes pasarán a preferir USD para operaciones futuras. Las filas históricas de tips, ledger y retiros conservarán su moneda original.

## Lenguaje neutral

- TipMe estará dirigido a cualquier persona que cree contenido, sin solicitar ni almacenar género.
- Se priorizarán frases naturalmente neutrales sobre formas repetitivas como `creador/a` o neologismos.
- Ejemplos:
  - `Bienvenida de vuelta` pasa a `Qué bueno verte de nuevo`.
  - `Creadora no encontrada` pasa a `Perfil no encontrado`.
  - El fallback `Creadora` pasa a `Tu cuenta`.
  - `El dashboard de la creadora es la fuente de verdad` pasa a `El dashboard de TipMe es la fuente de verdad`.
  - Las secciones administrativas usarán `Perfiles` o `Cuentas` cuando no sea necesario indicar el rol.
- También se actualizarán textos equivalentes en documentación visible del proyecto.
- Los nombres internos de rol y campos (`creator`, `creator_id`) se mantienen: son identificadores técnicos y cambiarlos aportaría riesgo sin mejorar la experiencia.

## Flujo de datos

1. Una persona completa su perfil sin seleccionar moneda.
2. El servidor guarda `preferred_currency = USD`.
3. El perfil público presenta importes predefinidos en USD.
4. Al crear un tip, el servidor obtiene o asigna USD y el proveedor recibe USD.
5. Webhook, ledger, saldo, notificación y comprobante conservan explícitamente `currency = USD`.
6. Un retiro solo puede solicitarse contra el saldo disponible en USD.

## Compatibilidad e historial

- No se aplicará conversión de divisas.
- Si existiera un movimiento histórico no USD, seguirá mostrándose con su moneda real en vistas históricas que lo consulten.
- Las operaciones nuevas no podrán originarse en otra moneda desde la UI ni mediante las acciones públicas del servidor.
- La capa `PaymentProvider` seguirá recibiendo un código de moneda, aunque por ahora siempre sea USD.

## Validación y seguridad

- Las acciones server-side de perfil y retiros validarán USD independientemente de los campos enviados por el navegador.
- La creación pública de tips no aceptará una moneda elegida por el fan.
- El ledger continuará separando movimientos por moneda y no mezclará saldos históricos.
- No se modificarán cantidades históricas para hacerlas parecer dólares.

## Interfaz afectada

- Registro/login: saludo neutral.
- Onboarding: USD fijo, sin selector.
- Configuración: USD informativo, sin selector editable.
- Perfil público y formulario de tip: importes USD.
- Dashboard, detalles, comprobantes, push y retiros: formato USD para operaciones nuevas.
- Administración y estados vacíos: lenguaje neutral.
- README: descripción neutral del producto.

## Pruebas

- Un perfil nuevo se guarda con USD aunque el navegador intente enviar otra moneda.
- Un tip nuevo se crea en USD y calcula correctamente unidades menores y comisión.
- Un retiro en otra moneda se rechaza server-side.
- El selector de moneda deja de aparecer en onboarding y configuración.
- Los textos públicos principales no contienen referencias de género detectadas.
- Los tests financieros existentes continúan demostrando idempotencia, ledger y límites de saldo.
- Se ejecutarán tests enfocados, typecheck, lint y build de producción.

## Fuera de alcance

- Conversión automática de monedas.
- Precios localizados por país.
- Liquidación en moneda local del proveedor.
- Cambiar los nombres técnicos `creator` o `creator_id`.
- Modificar valores de movimientos financieros históricos.
