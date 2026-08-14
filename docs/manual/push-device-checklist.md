# Checklist de Web Push en dispositivos reales

Registra para cada prueba:

- hora en que el mock confirma;
- hora en que llega el webhook;
- `processed_at` del evento;
- `push_attempted_at` del evento;
- hora aproximada de recepción en el dispositivo.

No se promete una latencia específica.

## iPhone o iPad

1. Abre la URL HTTPS desplegada en Safari.
2. Pulsa Compartir y “Añadir a pantalla de inicio”.
3. Abre TipMe desde el icono instalado.
4. Inicia sesión como Camila.
5. Abre configuración de notificaciones y pulsa “Activar notificaciones”.
6. Confirma que TipMe muestra “Notificaciones activadas”.
7. Cierra TipMe y bloquea el dispositivo.
8. Desde otro dispositivo o incógnito abre `/camila`.
9. Envía un tip mock aprobado.
10. Confirma que llega “Nuevo tip” sin abrir el dashboard.
11. Toca el push y confirma que abre `/dashboard/tips/<tipId>`.
12. Repite con un tip anónimo y confirma que no aparece el nombre real.

## Android

1. Abre la URL HTTPS desplegada en Chrome.
2. Inicia sesión y activa notificaciones mediante el botón.
3. Cierra TipMe y bloquea el dispositivo.
4. Genera un tip mock aprobado desde otro navegador.
5. Confirma recepción, título, cuerpo seguro y deep link.
6. Revoca el permiso, confirma que TipMe sigue funcionando y que no vuelve a pedir permiso automáticamente.

## Retiro

1. Solicita un retiro mock.
2. Simula `processing` y confirma que no se anuncia como completado.
3. Simula `completed` y confirma el push de retiro sin datos bancarios.
4. Repite con `failed` en otro retiro y confirma el mensaje de error seguro.

## Diagnóstico

- Push no aparece en iOS: confirma que TipMe se abrió desde el icono instalado, no desde una pestaña Safari.
- Permiso denegado: actívalo en Configuración del sistema; la web no puede revertirlo.
- Endpoint 404/410: la fila debe tener `revoked_at` después del intento.
- Dashboard no cambia: revisa Realtime para `tips`, `notifications` y `payouts`, luego recarga. El saldo en DB sigue siendo la fuente de verdad.

