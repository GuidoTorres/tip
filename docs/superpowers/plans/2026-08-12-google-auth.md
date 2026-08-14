# Google Auth Implementation Plan

> **For agentic workers:** Execute inline with test-driven development; this local task intentionally uses no branches, commits, or subagents.

**Goal:** Permitir que una creadora cree o abra su cuenta de TipMe con Google.

**Architecture:** Supabase inicia OAuth PKCE desde una server action y la ruta de callback guarda la sesión en cookies. Una función pura decide el destino posterior según el estado de onboarding y permite probar las reglas sin dependencias adicionales.

**Tech Stack:** Next.js App Router, TypeScript, Supabase SSR, Vitest.

## Global Constraints

- Los fans no crean cuentas.
- No añadir dependencias.
- No guardar secretos de Google en archivos del proyecto.
- No usar Git para este trabajo local.

---

### Task 1: Reglas de retorno OAuth

**Files:**
- Create: `src/features/auth/oauth.ts`
- Test: `tests/auth/oauth.test.ts`

- [ ] Escribir tests fallidos para destinos seguros y estado de onboarding.
- [ ] Ejecutar el test y verificar que falla porque el módulo no existe.
- [ ] Implementar las funciones puras mínimas.
- [ ] Ejecutar el test y verificar que pasa.

### Task 2: Inicio y callback de Google

**Files:**
- Modify: `src/features/auth/actions.ts`
- Create: `src/app/auth/callback/route.ts`

- [ ] Iniciar `signInWithOAuth` con callback local de TipMe.
- [ ] Intercambiar el código por sesión en el callback.
- [ ] Consultar el perfil y redirigir a onboarding o dashboard.
- [ ] Devolver errores a login sin filtrar detalles internos.

### Task 3: Botón y verificación

**Files:**
- Create: `src/components/auth/google-auth-button.tsx`
- Modify: `src/app/(auth)/signup/page.tsx`
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] Mostrar `Continuar con Google` sobre el formulario existente.
- [ ] Ejecutar test, typecheck y lint.
- [ ] Comprobar que el build de producción compila.

