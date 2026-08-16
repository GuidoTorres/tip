# Dashboard QR design

## Goal

Dar a cada creadora un QR permanente para que espectadores de un live abran directamente su menú público de tips sin registrarse.

## Dashboard

- Mostrar una sección compacta `Tu página` en el dashboard principal.
- Mostrar `tipme.pro/username` con acciones `Copiar link` y `Mostrar QR`.
- Generar el QR automáticamente; la creadora no configura nada.

## QR modal

- Modal accesible sobre el dashboard; no cambia de ruta ni abre otra pestaña.
- QR grande, oscuro sobre blanco y con margen amplio para lectura a distancia.
- El contenido es únicamente la URL pública `NEXT_PUBLIC_APP_URL/username`.
- Mostrar la URL como alternativa accesible.
- Ofrecer `Compartir QR`; si compartir archivos no está disponible, descargar el PNG.
- Cerrar con botón, clic en el fondo o tecla Escape y devolver el foco al botón de apertura.

## Fan flow

Escanear abre `/username`, donde el fan elige monto, nombre, mensaje y anonimato antes de enviar el tip. El QR no crea pagos, no contiene tokens y no expone datos privados.

## Architecture

Usar `qrcode` mediante importación dinámica cuando se abre el modal, evitando trabajo y JavaScript inicial innecesario. No usar servicios externos de QR. Mantener la construcción de la URL pública en una función pura reutilizable.

## Verification

Probar la construcción de la URL y la generación real de un PNG. Ejecutar pruebas enfocadas, typecheck, lint y build.
