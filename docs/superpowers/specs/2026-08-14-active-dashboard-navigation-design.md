# Active dashboard navigation design

## Goal

Permitir que la creadora reconozca inmediatamente en qué sección del dashboard se encuentra.

## Visual behavior

- La opción activa usa borde, texto e icono con el color `accent`, el mismo de la acción RETIRAR.
- Las opciones inactivas conservan un borde transparente para evitar cambios de tamaño al navegar.
- El estilo se aplica a la navegación móvil y de escritorio.
- No se añade relleno de color ni ornamentación adicional.

## Route matching

- `/dashboard` activa Inicio.
- `/dashboard/tips/*` también activa Inicio.
- `/dashboard/payouts` y sus páginas internas activan Retiros.
- `/dashboard/notifications` y sus páginas internas activan Avisos.
- `/dashboard/settings` y sus páginas internas activan Ajustes.

## Implementation

Convertir el componente compartido de navegación en un componente cliente para leer `usePathname()`. Mantener una sola lista de opciones y una función pura de coincidencia de rutas para móvil y escritorio.

## Accessibility and verification

Añadir `aria-current="page"` a la opción activa. Probar la función de coincidencia con rutas principales e internas y ejecutar typecheck y lint.
