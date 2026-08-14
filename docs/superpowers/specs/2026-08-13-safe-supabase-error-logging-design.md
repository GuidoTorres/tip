# Safe Supabase Error Logging Design

TipMe registrará en la consola del servidor los errores que Supabase devuelva al guardar el perfil de onboarding.

El registro contendrá únicamente un contexto fijo, el identificador técnico del usuario y los campos seguros `code`, `message`, `details` y `hint`. No serializará el objeto completo ni incluirá formulario, cookies, sesiones o variables de entorno. La respuesta visible para la creadora seguirá usando el error genérico actual.

La implementación será un helper pequeño y reutilizable, cubierto por una prueba que compruebe tanto los campos incluidos como la exclusión de propiedades desconocidas.
