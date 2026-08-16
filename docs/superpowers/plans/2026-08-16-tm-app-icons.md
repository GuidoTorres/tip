# TM App Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir el monograma `T` por `TM` en favicon, PWA, push y el recurso para Google Branding.

**Architecture:** Mantener una única fuente SVG y rasterizar los tamaños requeridos como artefactos estáticos. Next.js descubrirá `src/app/icon.svg`; el manifest seguirá usando los PNG públicos.

**Tech Stack:** SVG, PNG, Next.js metadata, Sharp como herramienta local de rasterización.

## Global Constraints

- Usar `#d95747` y `#fffaf7`.
- No añadir dependencias para generar assets una sola vez.
- No cambiar el wordmark textual `TipMe.`.
- No usar Git, ramas ni subagentes.

---

### Task 1: TM vector and raster assets

**Files:**
- Create: `src/app/icon.svg`
- Modify: `public/icons/icon-source.svg`
- Modify: `public/icons/icon-192.png`
- Modify: `public/icons/icon-512.png`
- Modify: `public/icons/maskable-512.png`
- Modify: `public/icons/badge-96.png`
- Create: `public/brand/tipme-google-logo-512.png`

- [ ] **Step 1: Create the TM vector**

Crear un SVG cuadrado con fondo coral redondeado y monograma claro `TM.` centrado dentro del área segura, reducido aproximadamente al 65% y con un punto menor que las letras.

- [ ] **Step 2: Rasterize required sizes**

Usar el `sharp` ya disponible para generar 192, 512, maskable 512, badge 96 y el PNG de Google desde la fuente SVG.

- [ ] **Step 3: Inspect generated assets**

Confirmar visualmente el icono de 512 y el badge de 96, y verificar sus dimensiones con metadatos de imagen.

- [ ] **Step 4: Verify application metadata**

Run: `npm.cmd run typecheck`

Run: `npm.cmd run lint`

Run: `npm.cmd run build`

Expected: todos finalizan con código 0.
