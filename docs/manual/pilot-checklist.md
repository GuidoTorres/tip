# Checklist del piloto

La creadora debe completar sin explicación técnica:

- registrarse;
- definir nombre, username, foto y descripción;
- configurar cuenta de retiro mock;
- activar notificaciones;
- copiar su link;
- reconocer un tip confirmado;
- entender disponible y pendiente;
- solicitar un retiro.

Observa dónde duda, retrocede o pide ayuda. Registra el paso, dispositivo, texto que no entendió y resultado esperado. No añadas funcionalidades durante la prueba; corrige primero fricción del recorrido crítico.

## Criterio de aceptación

Un webhook duplicado no cambia el saldo ni crea otra notificación lógica. Un tip anónimo no revela identidad. El dashboard abierto se actualiza sin refresh manual. Un retiro superior al disponible falla antes del provider y también en PostgreSQL.
