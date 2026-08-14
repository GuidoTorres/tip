# Interactive cursors design

## Goal

Hacer evidente en escritorio qué elementos de TipMe se pueden pulsar sin alterar la experiencia táctil móvil.

## Behavior

- Botones habilitados, enlaces, controles de selección y carga de archivos usan cursor de acción.
- Campos editables conservan el cursor propio de escritura.
- Controles deshabilitados usan cursor de bloqueo y nunca cursor de acción.
- La regla es global para que los componentes actuales y futuros se comporten igual.

## Implementation

Añadir reglas semánticas en `src/app/globals.css`. No modificar individualmente los componentes ni añadir dependencias.

## Verification

No añadir una prueba que solo inspeccione texto CSS: sería frágil y no comprobaría comportamiento real del navegador. Verificar el cambio con lint, typecheck y una revisión directa de los selectores y su orden de prioridad.
