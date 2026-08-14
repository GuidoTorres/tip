# Username Constraint Fix Implementation Plan

> **For agentic workers:** Implement inline using test-driven development; this local project intentionally does not use Git for this task.

**Goal:** Permitir usernames válidos y seguir rechazando únicamente los que contienen `__`.

**Architecture:** Reemplazar el patrón `LIKE` ambiguo por `position('__' in username::text) = 0` en el esquema base y añadir una migración correctiva idempotente para la base ya creada. Retirar también el atributo de formulario que React administra automáticamente.

**Tech Stack:** PostgreSQL, TypeScript, React 19, Vitest.

## Global Constraints

- Mantener la validación en frontend y base de datos.
- No modificar datos existentes.
- No usar Git.

---

### Task 1: Corregir la restricción y la advertencia del formulario

**Files:**
- Modify: `supabase/migrations/202608120001_tipme_core.sql`
- Create: `supabase/migrations/202608130001_fix_username_double_underscore.sql`
- Modify: `src/app/onboarding/page.tsx`
- Modify: `tests/database/migration-safety.test.ts`

- [ ] Añadir pruebas que detecten el patrón `LIKE` defectuoso y exijan una migración correctiva.
- [ ] Ejecutarlas y verificar que fallen.
- [ ] Corregir el esquema, crear la migración correctiva y quitar `encType`.
- [ ] Ejecutar pruebas, typecheck y lint.
