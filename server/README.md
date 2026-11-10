# Backend local SQL Server

La API conserva Contacto → Lead → LeadCaso → Caso → Beneficiario del esquema original. Las rutas validan con Zod, los servicios coordinan reglas/transacciones y los repositorios contienen SQL parametrizado. Los módulos se separan en `leads`, `profiles`, `messages`, `priorities`, `proposals`, `consents`, `cases`, `contracts`, `links`, `trials`, `handoffs` y `followup`. `operations/routes.mjs` agrupa operaciones complementarias.

## Base y ejecución

Por defecto conecta a `localhost`, base `LaPreDigital_OLTP`, con autenticación integrada Windows. Copiar `.env.example` a `.env` si aún no existe. No colocar credenciales en variables `VITE_*`. El adaptador persistente usa `System.Data.SqlClient` en Windows PowerShell/.NET Framework sin cambiar políticas de ejecución.

```bash
npm install
npm run migrate
npm run build
npm start
```

La base debe existir previamente. Las migraciones de `script/migrations` son explícitas y repetibles: añaden tablas `App_*` para Telegram, despachos, evidencias, pruebas, becas y análisis; permiten mensajes automáticos salientes de los orígenes previstos y agregan el evento de habilitación. El servidor no ejecuta el esquema ni inserta datos ficticios al arrancar.

Las transacciones usan aislamiento Serializable y contexto asíncrono compartido para operaciones compuestas. Los fallos revierten toda la operación. El adaptador actual requiere Windows; para Linux debe sustituirse.

La API escucha en `127.0.0.1:3001`, verifica host/origen y exige JSON en escrituras. Es una consola bajo la identidad Windows, sin autenticación HTTP ni autorización por usuario. El despliegue público requiere ambos controles.

## Reglas implementadas

| Área           | Comportamiento                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identidad      | Correo normalizado; teléfono compartido permitido; no fusiona beneficiarios solo por nombre.                                                                             |
| Perfil         | Universidad, carrera, disponibilidad y presupuesto con historial y procedencia humana/agente.                                                                            |
| Prioridad      | Interés, evidencia y contador de intentos entregados con plazo vencido. Consultar precio es Consulta por sí solo.                                                        |
| Consentimiento | Autoriza/revoca por canal y suspende seguimiento sin reiniciar agenda ni reactivar por sí solo prioridad Nula.                                                           |
| Propuesta      | Tarifa vigente; mensaje pendiente; aceptación/rechazo exige evidencia entrante del mismo caso posterior a la entrega.                                                    |
| Contratación   | Términos sobre propuesta aceptada, constancia de pago externo por importe autorizado y validación; conversión atribuida y cierre.                                        |
| Servicio       | Registra habilitación y etapa CUSTOMER; becas separadas de la conversión pagada.                                                                                         |
| Incidencias    | Devolución total invalidante antes de habilitar restaura etapa previa y bloquea promoción; no reabre automáticamente. Registra devolución parcial, disputa y resolución. |
| Responsable    | Invitación y aceptación local con autorización de contacto y vínculo independientes; participación y agenda propias.                                                     |
| Prueba         | Token de uso único con vencimiento; prueba única por beneficiario identificado y finalización periódica.                                                                 |
| Derivación     | Pausa automatización durante atención humana y registra atención/retoma según parámetro.                                                                                 |
| Seguimiento    | Revisa vencimientos, omite intentos bloqueados, expira pruebas y cierra casos inactivos; reapertura/nueva oportunidad según contexto y plazo.                            |

El pago es una constancia del operador sobre una confirmación externa con referencia; no consulta una pasarela. La entrega manual WhatsApp/correo también es una constancia humana. Telegram solo confirma entrega con el identificador del canal; no implica lectura.

## API

Los esquemas Zod de cada archivo de rutas son la referencia para los cuerpos JSON.

| Ruta                                                                   | Función                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------- |
| GET /api/health, /api/bootstrap                                        | Salud SQL y espacio de trabajo.                         |
| POST /api/leads                                                        | Captación/reutilización.                                |
| GET /api/participations/:id                                            | Expediente, mensajes, agenda, propuestas y eventos.     |
| PATCH /api/participations/:id/profile                                  | Perfil con historial.                                   |
| POST /api/participations/:id/messages/incoming                         | Evidencia entrante y reevaluación.                      |
| POST /api/participations/:id/evaluations                               | Evaluación con evidencia.                               |
| POST /api/participations/:id/proposals                                 | Preparación de propuesta.                               |
| POST /api/proposals/:id/response                                       | Aceptación/rechazo.                                     |
| POST /api/messages/:id/external-delivery                               | Constancia de entrega externa; excluye Telegram.        |
| POST /api/participations/:id/consent                                   | Autorización/revocación.                                |
| POST /api/cases/:id/terms, /payment-confirmation, /validate, /activate | Ciclo contractual.                                      |
| POST /api/cases/:id/incident, /scholarship, /scholarship/activate      | Incidencias y becas.                                    |
| POST /api/participations/:id/invitations; /api/invitations/accept      | Responsable económico.                                  |
| POST /api/participations/:id/trial-link; /api/trials/activate          | Prueba gratuita.                                        |
| POST /api/participations/:id/withdraw, /handoff, /handoff/attend       | Desistimiento y atención humana.                        |
| POST /api/followup/run                                                 | Revisión manual; no envía mensajes de red.              |
| GET /api/integrations/status                                           | Configuración Telegram, disponibilidad Ollama y agenda. |
| POST /api/participations/:id/telegram-link, /agent/analyze             | Vinculación temporal y análisis local.                  |

## Telegram: conexión local activa

El adaptador usa [Telegram Bot API](https://core.telegram.org/bots/api) con long polling. No requiere publicar la consola ni un webhook. El token local se verificó con `getMe`, el usuario se ajustó al bot devuelto por Telegram y el servidor quedó con `TELEGRAM_ENABLED=true`. Aún falta probar recepción y respuesta con una conversación iniciada por una persona.

1. Mantener `npm start` o `npm run server` activo. No ejecutar otro consumidor de `getUpdates` con el mismo bot.
2. Completar `/planes` y usar el enlace para continuar en Telegram, o escribir directamente al bot y responder las preguntas de captación. El expediente también permite generar un enlace para contactos ya registrados. Los enlaces son de un uso, vencen en diez minutos y se almacenan como hash. Una coincidencia con una identidad existente se revisa desde la consola antes de vincular otro chat.
3. Abrir el enlace con la cuenta Telegram del contacto y pulsar **Iniciar**. Enviar un mensaje. Si existen varias participaciones, el bot pide seleccionar beneficiario. `/autorizar` y `/revocar` funcionan sin esa selección.
4. Activar `FOLLOWUP_ENABLED=true` únicamente cuando se desee ejecutar la agenda periódica y reiniciar. Sigue desactivada para la primera prueba conversacional.

El token permanece solo en `.env`, excluido por `.gitignore`. No pegarlo en el chat ni subir el archivo al repositorio.

La bandeja de entrada/cursor son persistentes. El despacho reclama el mensaje antes de enviarlo. Una entrega incierta o un proceso interrumpido no generan reenvío automático que pueda duplicarlo. Un bloqueo SQL evita dos workers de esta aplicación sobre la misma base. Los indicadores muestran configuración; no sustituyen una prueba real.

## Ollama local

Configurar `OLLAMA_ENABLED=true`, `OLLAMA_URL=http://127.0.0.1:11434` y `OLLAMA_MODEL=llama3.2:3b`. Ollama debe estar iniciado con el modelo descargado. Solo se permiten direcciones locales. Usa [chat estructurado](https://docs.ollama.com/api/chat), validación Zod y citas para respaldar campos extraídos.

`npm run check:ollama` realiza una consulta real y fue comprobado con el modelo local. `npm test` no depende del LLM ni de Telegram externo. El agente propone intención/campos; las reglas y tarifas del servidor deciden las operaciones. Las respuestas automáticas usan plantillas controladas. El modelo pequeño puede omitir campos o interpretar frases mal: revisar el análisis antes de guardar cambios manuales. No confirma pagos ni inventa precios o beneficios.

## Stripe Checkout de prueba

En el panel de Stripe, activar modo de prueba y guardar la clave secreta `sk_test_...` en `STRIPE_SECRET_KEY` de `.env`. La aplicación rechaza claves `sk_live_...`. Reiniciar `npm start` o `npm run server`. Tras aceptar una propuesta y registrar las condiciones, usar **Pagar con Stripe de prueba** en el expediente. Checkout cobra el precio autorizado de SQL Server en PEN y vuelve a la aplicación con el identificador de sesión. El servidor consulta la sesión en Stripe, exige `payment_status=paid`, modo de prueba, importe, moneda, caso y contratación coincidentes, y registra el pago con la sesión como referencia. Luego se puede validar la contratación. Las tarjetas de prueba se encuentran en la [documentación oficial](https://docs.stripe.com/testing).

El portal del lead está en `/planes`. La captación completa crea o vincula la negociación; los datos incompletos y las coincidencias de identidad quedan pendientes de revisión. La consola muestra las solicitudes web y las provisionales de Telegram, con acciones para completarlas o abrir la negociación. El agente prepara propuestas y adjunta un enlace personal; la aceptación exige que su entrega ya esté confirmada. El lead ve el precio autorizado, acepta expresamente y puede abrir Checkout en `/oferta/<token>`. La aceptación se registra como mensaje del canal Portal web y su evidencia no se atribuye al operador. `/prueba/<token>` registra la activación expresa de Explora y `/invitacion/<codigo>` permite al responsable aceptar la vinculación y el contacto por separado. Ver [el plan y recorrido de prueba](../docs/plan-agente.md).

Configurar `STRIPE_WEBHOOK_SECRET=whsec_...` además de la clave de prueba. En desarrollo, Stripe CLI puede reenviar los eventos con `stripe listen --forward-to localhost:3001/api/stripe/webhook`; copiar el secreto que muestra a `.env` y reiniciar el servidor. El webhook comprueba firma y antigüedad, recupera la sesión desde Stripe, exige pago, moneda, importe y contratación coincidentes y usa la sesión como referencia idempotente. El regreso del navegador realiza la misma conciliación. [Stripe recomienda procesar eventos del servidor](https://docs.stripe.com/payments/existing-customers?platform=web&ui=stripe-hosted).

La clave `sk_test_...` local respondió correctamente a una consulta de la cuenta Stripe. Falta `STRIPE_WEBHOOK_SECRET`, por lo que no se realizó un pago completo ni una entrega real de webhook. Para compartir `/planes` y `/oferta` fuera del equipo se necesita un dominio HTTPS y un proxy; configurar `PUBLIC_ORIGIN` y `BIND_HOST` según `.env.example`. Mantener las rutas administrativas restringidas a localhost. Antes de publicar ampliamente se requieren protección contra abuso del formulario, verificación de identidad del destinatario y autenticación de operadores.

## Verificación

`npm test` cubre reglas, contratación, consentimiento, reapertura, responsable, pruebas/becas, seguimiento, API HTTP, formato SQL y adaptadores controlados. Las pruebas de negocio usan SQL Server real con rollback obligatorio. No dejan contactos de prueba, aunque consumen IDENTITY. Requieren la base migrada y permisos de lectura/escritura. `npm run build` valida TypeScript; `npm run format:check` comprueba el formato.

La revisión visual automatizada de esta entrega quedó pendiente: ambos controladores fallaron al inicializar con `failed to write kernel assets`. La compilación y las pruebas HTTP no sustituyen esa inspección.

## Alcance pendiente del informe

- Verificar Telegram → SQL → Ollama → respuesta, revocación y selección de beneficiario con cuentas reales; el bot ya está configurado y el servidor escucha.
- Verificar con personas reales el alta F9, los enlaces de Telegram y la aceptación de invitaciones públicas; las pruebas automatizadas usan adaptadores controlados y rollback.
- Prueba real del webhook y Checkout con claves de Stripe, conciliación de reembolsos/disputas y plataforma educativa para aplicar accesos, pruebas y habilitaciones.
- Conectores de WhatsApp/correo. La retoma de una derivación ya prepara un aviso Telegram vinculado al mensaje pendiente.
- Perfil académico ampliado y recorridos excepcionales restantes del informe.
- DataMart/ETL y seis KPI actualizados, incluida la conversión pagada de casos con Alta.
- Autenticación, permisos, auditoría por usuario real, observabilidad y operación de producción.

Los flujos implementados no equivalen al cumplimiento integral del informe ni a una integración de pagos o aprendizaje en producción.
