# Implementación del Agente Negociador

Referencia: informe actualizado, secciones 2.1–2.6 y F1–F9. Canal inicial: Telegram. Modelo: Ollama local.

## Recorrido que debe funcionar

1. Captación web completa o conversación directa en Telegram.
2. Identificación del contacto y del beneficiario, reutilizando registros confirmados.
3. Creación o reutilización de LEAD, caso abierto y participación Pendiente mediante reglas.
4. Conversación: ampliar perfil, responder consultas y objeciones, proponer nivel de interés.
5. Propuesta autorizada o enlace de prueba; aceptación expresa y pago verificado por Stripe.
6. Seguimiento único según agenda; derivación humana y suspensión según reglas del informe.

## Entregas y comprobaciones

- Captación: teléfono y rol, solicitud provisional si falta beneficiario, correlación con participación, reenvíos idempotentes y acceso desde la consola sin copiar datos.
- Telegram: continuar desde el formulario mediante enlace temporal; completar datos de remitentes nuevos mediante preguntas concretas y registrar mensajes.
- Agente: usar el perfil y el historial; respuestas de catálogo verificables; evitar repetir propuestas; dos fallos consecutivos de interpretación derivan a una persona.
- Comercial: entregar automáticamente por Telegram y facilitar aceptación/pago mediante enlace personal. La entrega, la aceptación, el pago y la validación siguen siendo eventos distintos.
- Operación: mostrar estado de captación y negociación; conservar evidencia y errores; probar con SQL Server y rollback, cliente Telegram controlado y compilación frontend.

## Estado de la implementación

Implementado: captación completa, alta guiada por Telegram, captación provisional, revisión local de identidad, vinculación desde la consola, contexto del formulario y de conversaciones, preguntas de perfil registradas, catálogo compartido con el frontend, propuestas con enlace personal sin duplicar la alternativa vigente, prueba gratuita con activación expresa, detección de responsable e invitación pública con dos autorizaciones, derivación tras dos mensajes no interpretables, actualización de perfil durante la pausa, aviso de retoma y descarte de solicitudes inactivas.

La IA analiza y propone las acciones. Los servicios existentes aplican las reglas y las escrituras transaccionales. La interfaz de revisión sigue disponible para corregir errores y atender excepciones.

Las pruebas automatizadas usan SQL Server con rollback y un cliente Telegram controlado. Ollama se comprueba mediante una consulta local real. No se acredita una conversación real completa ni un pago real por estas pruebas.

Una captación por chat que todavía no tiene autorización de ningún canal permanece provisional. El contacto puede consultar planes y completar después su autorización, sin generar una agenda mientras la rechace.

## Probar el recorrido local

1. Ejecutar `npm run migrate`, `npm run build` y `npm start`.
2. Abrir `/planes`, seleccionar plan y completar nombre, correo, teléfono, rol y autorización. Si el correo o el beneficiario coinciden con una identidad existente, resolver la revisión desde LEADS y casos.
3. Pulsar Continuar en Telegram e Iniciar. También se puede escribir directamente al bot y completar sus preguntas de registro.
4. Usar `/autorizar` para habilitar seguimiento por Telegram o `/revocar` para retirarlo. Responder una conversación no requiere autorizar comunicaciones proactivas.
5. Preguntar por planes, declarar carrera y disponibilidad, y solicitar una propuesta indicando plan y modalidad. El agente envía la propuesta con enlace personal.
6. Abrir el enlace, aceptar expresamente y pagar en Stripe de prueba. La validación comercial sigue en el expediente.
7. Para probar la vinculación económica, indicar que otra persona decide o paga y proporcionar su nombre, teléfono y rol. Reenviar a esa persona el enlace de invitación; el agente no la contacta antes de su autorización.

`FOLLOWUP_ENABLED=true` habilita los intentos programados. Los intentos sin un canal utilizable se omiten; no se reprograman. El mantenimiento de derivaciones y solicitudes funciona aunque la agenda proactiva esté desactivada.

Un enlace con `127.0.0.1` se abre en el mismo equipo que ejecuta la aplicación. Para abrir ofertas, invitaciones o pruebas desde un teléfono se necesita configurar `PUBLIC_ORIGIN` con una dirección accesible y publicar exclusivamente las rutas públicas según la guía del backend.

## Reglas obligatorias

El modelo no escribe SQL ni decide prioridades, precios, autorizaciones, pagos o cierres. No inventar datos. Telegram requiere que la persona inicie el bot. Fuera de la agenda, responder únicamente a mensajes entrantes. Una participación conserva una sola agenda. No ofrecer descuentos; derivar a personal comercial. Explora requiere beneficiario identificado y no genera propuesta pagada.

La coincidencia de un correo declarado públicamente no acredita identidad. No dar acceso al historial de un contacto existente desde el formulario ni desde un chat nuevo sin una vinculación comprobada; presentar esos casos al operador.

## Dependencias externas y alcance

El primer recorrido se completa en Telegram. El envío real por correo o WhatsApp requiere sus conectores. Stripe se conserva en modo de prueba. La habilitación efectiva de cursos requiere integrar la plataforma educativa. DataMart, ETL y KPI son un avance posterior independiente de la conversación comercial; no presentar los contadores OLTP como esos indicadores.
