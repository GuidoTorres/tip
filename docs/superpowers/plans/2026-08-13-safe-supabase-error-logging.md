# Safe Supabase Error Logging Implementation Plan

> **For agentic workers:** Implement inline using test-driven development; this local project intentionally does not use Git for this task.

**Goal:** Mostrar en la consola del servidor el error real de Supabase al guardar el perfil sin filtrar información sensible.

**Architecture:** Crear un helper server-side que construye explícitamente un registro permitido y lo envía a `console.error`. Usarlo solo en la rama de error de `saveOnboardingProfile`.

**Tech Stack:** TypeScript, Next.js Server Actions, Vitest.

## Global Constraints

- No imprimir el objeto de error completo.
- No imprimir datos del formulario, cookies, claves ni tokens.
- No cambiar RLS ni el comportamiento visible del formulario.

---

### Task 1: Logger seguro del onboarding

**Files:**
- Create: `src/lib/logging/supabase-error.ts`
- Modify: `src/features/profiles/actions.ts`
- Test: `tests/logging/supabase-error.test.ts`

**Interface:**
- `logSupabaseError(context: string, error: SupabaseErrorLike, userId?: string): void`

- [ ] Escribir una prueba que exija los campos permitidos y rechace propiedades adicionales.
- [ ] Ejecutar la prueba y confirmar que falla porque el helper aún no existe.
- [ ] Implementar el helper mínimo y conectarlo a `saveOnboardingProfile`.
- [ ] Ejecutar la prueba, typecheck y lint.
