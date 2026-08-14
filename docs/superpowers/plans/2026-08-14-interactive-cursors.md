# Interactive Cursors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar el cursor correcto sobre todos los controles interactivos de TipMe.

**Architecture:** Resolver el comportamiento en la hoja global mediante selectores semánticos. Los campos de escritura conservan su cursor nativo y la regla de controles deshabilitados tiene prioridad.

**Tech Stack:** CSS, Tailwind CSS 4, Next.js.

## Global Constraints

- No añadir dependencias.
- No editar individualmente los componentes.
- No usar Git, ramas ni subagentes.
- No añadir pruebas que solamente inspeccionen el texto del CSS.

---

### Task 1: Global interactive cursor states

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: elementos HTML semánticos existentes.
- Produces: cursores consistentes para controles habilitados y deshabilitados.

- [ ] **Step 1: Add enabled interactive cursor rules**

Añadir después de la normalización de controles:

```css
:where(a[href], button:not(:disabled), select:not(:disabled), label[for], input:is([type="checkbox"], [type="radio"], [type="file"]):not(:disabled), [role="button"]:not([aria-disabled="true"])) {
  cursor: pointer;
}
```

- [ ] **Step 2: Add disabled cursor priority**

```css
:where(button, select, input, [role="button"]):is(:disabled, [aria-disabled="true"]) {
  cursor: not-allowed;
}
```

- [ ] **Step 3: Verify static quality**

Run: `npm.cmd run typecheck`

Expected: exit code 0.

Run: `npm.cmd run lint`

Expected: exit code 0.

- [ ] **Step 4: Review selector behavior**

Confirmar que enlaces y controles habilitados reciben `pointer`, que inputs de texto no están incluidos y que la regla deshabilitada aparece después para ganar prioridad.
