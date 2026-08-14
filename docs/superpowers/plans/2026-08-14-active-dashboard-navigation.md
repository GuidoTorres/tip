# Active Dashboard Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resaltar con el color de acento la sección activa del dashboard en móvil y escritorio.

**Architecture:** Una función pura determina si una ruta corresponde a cada opción del menú. El componente cliente lee `usePathname()` y utiliza el mismo resultado para las dos presentaciones de navegación.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest.

## Global Constraints

- No añadir dependencias.
- Mantener una sola lista de navegación.
- Usar el token `accent` existente.
- No usar Git, ramas ni subagentes.

---

### Task 1: Route matching

**Files:**
- Create: `src/components/dashboard/navigation-state.ts`
- Create: `tests/ui/dashboard-navigation.test.ts`

**Interfaces:**
- Produces: `isDashboardItemActive(pathname: string, href: string): boolean`.

- [ ] **Step 1: Write the failing route tests**

Comprobar con casos literales que Inicio coincide con `/dashboard` y `/dashboard/tips/tip-1`, que Ajustes coincide con `/dashboard/settings/notifications`, y que rutas con prefijos parecidos no coinciden.

- [ ] **Step 2: Verify the tests fail**

Run: `npm.cmd test -- tests/ui/dashboard-navigation.test.ts --maxWorkers=1`

Expected: FAIL porque `navigation-state.ts` aún no existe.

- [ ] **Step 3: Implement the matcher**

Inicio coincide exactamente con `/dashboard` o con `/dashboard/tips/`. Las demás opciones coinciden exactamente o cuando el pathname comienza con `href + "/"`.

- [ ] **Step 4: Verify the focused tests pass**

Run: `npm.cmd test -- tests/ui/dashboard-navigation.test.ts --maxWorkers=1`

Expected: PASS.

### Task 2: Active navigation presentation

**Files:**
- Modify: `src/components/dashboard/mobile-nav.tsx`

**Interfaces:**
- Consumes: `isDashboardItemActive(pathname, href)`.
- Produces: `MobileNav` y `DesktopNav` con estado visual y `aria-current`.

- [ ] **Step 1: Make navigation pathname-aware**

Convertir el archivo en componente cliente, leer `usePathname()` una vez por componente y calcular el estado de cada enlace.

- [ ] **Step 2: Add stable active styles**

Usar `border-accent text-accent` cuando esté activo y `border-transparent` cuando esté inactivo. Mantener `rounded-xl` en móvil y `rounded-full` en escritorio.

- [ ] **Step 3: Add accessible state**

Asignar `aria-current={active ? "page" : undefined}` a cada enlace.

- [ ] **Step 4: Verify the change**

Run: `npm.cmd test -- tests/ui/dashboard-navigation.test.ts --maxWorkers=1`

Run: `npm.cmd run typecheck`

Run: `npm.cmd run lint`

Expected: todos finalizan con código 0.
