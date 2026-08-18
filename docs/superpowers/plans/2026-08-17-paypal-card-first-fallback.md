# PayPal Card-First Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar tarjeta directa con los tres campos mínimos y revelar el checkout con cuenta PayPal únicamente cuando Card Fields no sea elegible.

**Architecture:** Mantener una sola orden PayPal y los endpoints actuales. El componente cliente consulta `CardFields.isEligible()`: si es verdadero renderiza número, vencimiento y CVV; si es falso oculta la tarjeta y muestra el botón PayPal acompañado de una explicación de la fricción adicional.

**Tech Stack:** Next.js App Router, React 19, TypeScript, PayPal JavaScript SDK Card Fields, Vitest.

## Global Constraints

- No añadir dependencias.
- No usar Git ni ramas.
- TipMe nunca recibe ni almacena número de tarjeta o CVV.
- El frontend no confirma pagos ni modifica saldos.
- El fallback puede solicitar inicio de sesión o datos adicionales según PayPal.

---

### Task 1: Checkout centrado en tarjeta

**Files:**
- Modify: `src/components/payments/paypal-checkout.tsx`
- Modify: `src/components/payments/paypal-sdk.ts`
- Test: `tests/payments/paypal-checkout.test.tsx`

**Interfaces:**
- Consumes: `PayPalCardFields.isEligible()`, `PayPalCardFields.submit()` y `PayPalNamespace.Buttons()`.
- Produces: `PayPalCheckout` con tarjeta primaria y fallback PayPal condicionado por elegibilidad.

- [ ] **Step 1: Escribir la prueba que falla**

Actualizar la prueba para exigir número, vencimiento y CVV, y rechazar el campo de nombre y un botón PayPal visible inicialmente:

```tsx
expect(html).toContain("paypal-card-number");
expect(html).toContain("paypal-card-expiry");
expect(html).toContain("paypal-card-cvv");
expect(html).not.toContain("paypal-card-name");
expect(html).not.toContain("Nombre del titular");
expect(html).toContain('aria-hidden="true"');
```

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npm.cmd test -- tests/payments/paypal-checkout.test.tsx`

Expected: FAIL porque el nombre todavía se renderiza y el fallback no está oculto.

- [ ] **Step 3: Implementar el cambio mínimo**

En `PayPalCardFields`, eliminar `NameField()`. En `PayPalCheckout`, no renderizar el campo de nombre. Mantener el contenedor SDK de botones montado, pero oculto y con `aria-hidden` mientras `cardEligible` sea verdadero. Cuando `isEligible()` sea falso, mostrar:

```text
La tarjeta directa no está disponible para este pago.
Continúa con PayPal; podría pedirte iniciar sesión o verificar otros datos.
```

El formulario directo conservará solamente `NumberField`, `ExpiryField`, `CVVField` y el botón `Pagar con tarjeta`.

- [ ] **Step 4: Ejecutar la prueba enfocada**

Run: `npm.cmd test -- tests/payments/paypal-checkout.test.tsx`

Expected: PASS.

### Task 2: Verificación de regresiones

**Files:**
- Verify: `src/components/payments/paypal-checkout.tsx`
- Verify: `src/components/payments/paypal-sdk.ts`
- Verify: `tests/payments/paypal-checkout.test.tsx`

**Interfaces:**
- Consumes: scripts existentes de TypeScript, ESLint y Vitest.
- Produces: evidencia de que checkout, tipos y resto de pagos siguen válidos.

- [ ] **Step 1: Ejecutar pruebas de PayPal**

Run: `npm.cmd test -- tests/payments/paypal-checkout.test.tsx tests/ui/paypal-standard-sandbox.test.tsx tests/payments/paypal-provider.test.ts`

Expected: todas las pruebas pasan.

- [ ] **Step 2: Ejecutar typecheck y lint**

Run: `npm.cmd run typecheck`

Expected: exit code 0.

Run: `npm.cmd run lint`

Expected: exit code 0.

- [ ] **Step 3: Ejecutar la suite completa**

Run: `npm.cmd test`

Expected: todas las pruebas pasan.
