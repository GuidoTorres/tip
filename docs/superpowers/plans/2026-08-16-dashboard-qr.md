# Dashboard QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que una creadora copie su link o muestre y comparta un QR permanente desde el dashboard principal.

**Architecture:** Una función pura construye la URL pública y un adaptador pequeño genera el PNG mediante `qrcode`. El dashboard muestra las acciones principales y carga dinámicamente el generador al abrir un modal nativo con compartir/descargar como mejora progresiva.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, `qrcode` 1.5.4, Vitest, Web Share API.

## Global Constraints

- El QR contiene solamente `NEXT_PUBLIC_APP_URL/username`.
- No crear pagos ni tokens al generar el QR.
- No enviar datos a servicios externos.
- Mantener el flujo sin login para el fan.
- No usar Git, ramas ni subagentes.

---

### Task 1: Public URL and QR generation

**Files:**
- Create: `src/features/profiles/public-url.ts`
- Create: `src/features/profiles/qr-code.ts`
- Create: `tests/domain/public-profile-qr.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `buildPublicProfileUrl(appUrl: string, username: string): string`.
- Produces: `generatePublicProfileQr(url: string): Promise<string>`.

- [ ] **Step 1: Write failing tests**

Probar que la URL elimina barras finales, codifica el username y que el generador devuelve un PNG data URL real.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- tests/domain/public-profile-qr.test.ts --maxWorkers=1`

Expected: FAIL porque los módulos no existen.

- [ ] **Step 3: Install the QR generator**

Run: `npm.cmd install qrcode@1.5.4`

Run: `npm.cmd install --save-dev @types/qrcode`

- [ ] **Step 4: Implement minimal generation**

Construir la URL con `encodeURIComponent` y generar un PNG de 768 píxeles, margen 4, corrección `M`, módulos `#222321` y fondo blanco.

- [ ] **Step 5: Verify GREEN**

Run: `npm.cmd test -- tests/domain/public-profile-qr.test.ts --maxWorkers=1`

Expected: PASS.

### Task 2: Dashboard share card

**Files:**
- Create: `src/components/dashboard/creator-share-card.tsx`
- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `publicUrl: string`.
- Produces: link visible, `Copiar link` y navegación a `/dashboard/qr`.

- [ ] **Step 1: Include username in the profile query**

Añadir `username` a la lectura existente y construir la URL con `buildPublicProfileUrl`.

- [ ] **Step 2: Render the compact card**

Colocar `Tu página` después del resumen de saldo, con botones grandes y comportamiento mobile-first.

### Task 3: QR modal and sharing

**Files:**
- Create: `src/components/dashboard/creator-qr.tsx`
- Create: `src/components/dashboard/share-qr-button.tsx`

**Interfaces:**
- Consumes: PNG data URL, URL pública y username.
- Produces: modal grande, compartir archivo cuando Web Share lo soporte y descarga como fallback.

- [ ] **Step 1: Create the dashboard QR modal**

Abrir un `dialog` nativo desde `Mostrar QR`, importar el generador bajo demanda y mostrar estados de carga/error. Cerrar con botón, fondo o Escape.

- [ ] **Step 2: Add progressive sharing**

Convertir el data URL a `File`; usar `navigator.canShare({ files })` y `navigator.share`. Descargar `tipme-<username>-qr.png` cuando compartir archivos no esté disponible.

- [ ] **Step 3: Verify all behavior**

Run: `npm.cmd test -- tests/domain/public-profile-qr.test.ts tests/ui/dashboard-navigation.test.ts --maxWorkers=1`

Run: `npm.cmd run typecheck`

Run: `npm.cmd run lint`

Run: `npm.cmd run build`

Expected: todos finalizan con código 0.

- [ ] **Step 4: Manual scan check**

Abrir y cerrar el modal sin navegación. Escanear el QR mostrado y confirmar que abre el menú público correcto. Si no hay dos dispositivos disponibles, reportar esta comprobación como pendiente sin afirmar que se realizó.
