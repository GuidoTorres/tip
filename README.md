# TipMe

TipMe es un MVP mobile-first para que quienes crean contenido reciban tips verificables sin obligar al fan a registrarse. El flujo crítico es:

```text
Fan envía tip -> provider -> webhook verificado -> ledger -> saldo -> notificación -> Web Push
```

El proyecto usa dinero mock. No conecta tarjetas, bancos ni proveedores financieros reales.

## Stack

- Next.js 16 App Router, React 19 y TypeScript
- Tailwind CSS 4
- Supabase Auth, PostgreSQL, Storage y Realtime
- PWA, Service Worker, Push API, Notifications API y VAPID
- Vitest para reglas financieras y de seguridad
- Vercel como destino de despliegue

No usa ORM, librería de estado global ni SDK financiero específico.

## Requisitos

- Node.js 22 o superior
- npm 10 o superior
- Un proyecto Supabase para ejecutar el flujo integrado
- Supabase CLI y Docker solo si quieres usar Supabase local
- Una cuenta Vercel para desplegar

## Instalación

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Abre `http://localhost:3000`.

Los valores de `.env.example` son ficticios. Permiten instalar, probar, verificar tipos y construir, pero no conectan Auth, PostgreSQL, Storage, Realtime ni Push.

## Variables de entorno

Edita `.env.local`:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
PLATFORM_FEE_BPS=300
PAYMENT_PROVIDER=mock
MOCK_WEBHOOK_SECRET=GENERA_UN_SECRETO_LARGO
NEXT_PUBLIC_VAPID_PUBLIC_KEY=TU_CLAVE_PUBLICA_VAPID
VAPID_PRIVATE_KEY=TU_CLAVE_PRIVADA_VAPID
VAPID_SUBJECT=mailto:tu-email@dominio.com
```

Reglas:

- Nunca publiques `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY` ni `MOCK_WEBHOOK_SECRET`.
- `PLATFORM_FEE_BPS=300` equivale a 3%. El código no hardcodea esta comisión.
- Conserva `PAYMENT_PROVIDER=mock` hasta tener documentación y credenciales sandbox del proveedor definitivo.
- Las variables Nuvei, EBANX y dLocal vacías son marcadores futuros. No existen adaptadores ficticios.

## Configurar Supabase

### Proyecto alojado

1. Crea un proyecto en Supabase.
2. Instala Supabase CLI si aún no lo tienes.
3. Desde esta carpeta ejecuta:

```powershell
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

4. Copia URL, anon key y service role key a `.env.local`.
5. Confirma en Storage que existe el bucket público `avatars` con límite de 5 MB.

### Proyecto local

```powershell
supabase start
supabase db reset
```

`db reset` aplica [la migración principal](supabase/migrations/202608120001_tipme_core.sql) y [los datos demo](supabase/seed.sql).

Datos demo locales:

- Email: `camila@demo.tipme.pro`
- Contraseña: `TipMe-Demo-2026!`
- Perfil: `http://localhost:3000/camila`

No apliques el seed demo en producción. Sus UUID son determinísticos y pueden eliminarse fácilmente buscando los prefijos `10000000`, `20000000` y `30000000`.

## VAPID y Web Push

Genera un par VAPID una vez:

```powershell
npx web-push generate-vapid-keys
```

Coloca la clave pública en `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y la privada en `VAPID_PRIVATE_KEY`. La clave privada nunca se importa en componentes cliente.

Web Push requiere HTTPS, salvo `localhost`. En iPhone/iPad se debe añadir TipMe a la pantalla de inicio, abrirla desde el icono y pulsar explícitamente “Activar notificaciones”.

Cada dispositivo crea una fila en `push_subscriptions`. Un endpoint que devuelve 404 o 410 queda revocado. Un mismo evento financiero crea una notificación lógica y puede enviarse a varios dispositivos.

## Pagos mock

1. Abre `/camila` sin iniciar sesión como fan.
2. Selecciona un monto, nombre/mensaje opcionales y anonimato.
3. Pulsa `ENVIAR TIP`.
4. En desarrollo se abre `/pay/mock/<paymentId>`.
5. Elige aprobado, pendiente o rechazado.

La opción aprobada genera un evento firmado y ejecuta el mismo procesador que `/api/webhooks/payments`. El navegador no confirma el tip ni modifica el saldo.

Los simuladores devuelven 404 en producción por diseño. Para una demostración desplegada con dinero mock, usa un Vercel Preview Deployment, no el entorno Production.

## Ledger y saldos

No existe una columna balance editable. `creator_balances` suma `ledger_entries` por moneda. Los movimientos son inmutables y cubren tip confirmado, comisiones, refund, chargeback, reserva, liberación y payout.

El gateway fee permanece `null` mientras el proveedor no informe un valor exacto. La UI muestra “Pendiente”, nunca una comisión inventada.

No hay conversión entre monedas. Cada saldo se reconstruye en su moneda original.

## Retiros mock

1. Completa la cuenta de retiro mock durante onboarding.
2. Abre `/dashboard/payouts`.
3. Solicita un monto menor o igual al disponible.
4. En desarrollo usa `Procesar`, luego `Completar` o `Fallar`.

La base de datos bloquea simultáneamente el saldo por perfil y moneda antes de reservar el retiro. Completar o fallar inserta movimientos compensatorios una sola vez y crea la notificación correspondiente.

## Pruebas y verificación

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Las pruebas automatizadas se concentran en:

- importes enteros y comisión en basis points;
- usernames reservados;
- transiciones de tips;
- creación sin cuenta fan;
- eliminación de identidad anónima;
- firmas HMAC y replay window;
- idempotencia de webhooks;
- reglas de push y endpoints vencidos;
- límite de saldo y eventos de payout.

La verificación SQL/RLS está en [database-verification.md](docs/manual/database-verification.md). Requiere Supabase local o remoto configurado.

## PWA

- Manifest: `/manifest.webmanifest`
- Service Worker: `/sw.js`
- Iconos: `public/icons`
- Inicio instalado: `/dashboard`
- Deep link del tip: `/dashboard/tips/<tipId>`
- Fallback offline: `/offline`

El dashboard usa Supabase Realtime y hace `router.refresh()`. Nunca suma dinero en el cliente.

## Despliegue en Vercel

1. Importa esta carpeta/repositorio en Vercel.
2. Configura todas las variables de `.env.example` con valores reales.
3. Usa `NEXT_PUBLIC_APP_URL=https://tipme.pro` en producción.
4. Añade `tipme.pro` como dominio.
5. Añade `https://tipme.pro/**` a las redirect URLs de Supabase Auth.
6. Ejecuta `supabase db push` contra el proyecto correcto.
7. Despliega y ejecuta el checklist físico de push.

El comando de build es `npm run build`; no necesita secretos reales para compilar.

## Añadir un gateway real en el futuro

Implementa `PaymentProvider` en un archivo nuevo, por ejemplo `src/features/payments/dlocal-provider.ts`, usando exclusivamente documentación oficial y credenciales sandbox. Después regístralo en `provider-factory.ts`.

El adaptador debe implementar creación/consulta de pagos y payouts, verificación/parser de webhook y fees exactos. No cambies ledger, dashboard ni flujo de confirmación. KYC/KYB pertenece al proveedor real.

## Límites del MVP

- El rate limit actual es una protección en memoria por instancia. Para un piloto de dos perfiles es razonable; antes de tráfico real debe migrarse a una store distribuida.
- El admin es observacional. No se incluyeron mutaciones financieras manuales para reducir riesgo.
- La entrega física de Push no puede certificarse mediante tests de escritorio. Usa [push-device-checklist.md](docs/manual/push-device-checklist.md).
- Los simuladores mock están desactivados en el entorno Vercel Production. Se habilitan en desarrollo local y Vercel Preview para el piloto.

Para asignar el primer admin, hazlo únicamente desde SQL Editor o una operación server-side controlada:

```sql
update public.profiles set role = 'admin' where id = 'UUID_DEL_USUARIO';
```

La aplicación cliente no dispone de ninguna acción para elevar roles.
