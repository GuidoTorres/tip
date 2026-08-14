# Google Auth Design

TipMe ofrecerá OAuth de Google únicamente a creadoras, junto al acceso existente por email y contraseña. Los fans seguirán sin crear cuentas.

El botón `Continuar con Google` aparecerá en `/signup` y `/login`. Iniciará el flujo PKCE de Supabase Auth y regresará a `/auth/callback`. El callback intercambiará el código por una sesión, consultará `profiles.onboarding_completed` y enviará cuentas nuevas a `/onboarding` y cuentas existentes a `/dashboard`.

Los destinos de retorno serán rutas internas permitidas para evitar redirecciones abiertas. Un error del proveedor o del intercambio regresará a `/login?error=oauth_failed` sin mostrar detalles técnicos. El trigger existente sobre `auth.users` seguirá siendo responsable de crear el perfil.

No se añadirán dependencias, Google One Tap ni secretos de Google al repositorio. El Client ID y Client Secret permanecerán configurados dentro de Supabase.

