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

`npm run migrate` aplica `script/LaPreDigital_OLTP.sql` con `sqlcmd`; el script crea la base si no existe y es repetible. Contiene el esquema del informe, tablas `App_*` de apoyo y las tablas `UsuarioPlataforma` y `HabilitacionAcceso`. Las tablas nuevas se agregan conservando los datos existentes; un cambio de columnas existentes requiere su migración específica. La unicidad de `requestKey` en solicitudes públicas se resuelve con un trigger. El servidor no ejecuta el esquema ni inserta datos ficticios al arrancar.

Las transacciones usan aislamiento Serializable y contexto asíncrono compartido para operaciones compuestas. Los fallos revierten toda la operación. El adaptador actual requiere Windows; para Linux debe sustituirse.

La API escucha en `127.0.0.1:3067`, verifica host/origen y exige JSON en escrituras. La conexión SQL usa la identidad Windows configurada; el acceso HTTP a la consola requiere una sesión del único administrador. La consola sigue limitada a localhost.

## Autenticación de la consola

`dbo.App_AdminUser` admite únicamente la fila de `admin`; la contraseña solicitada `password` se guarda como hash scrypt con sal. `npm run migrate` crea y prepara la cuenta sin reemplazarla si existe; `db:clean` la conserva. La autenticación reutiliza la comprobación de contraseñas de `server/access/crypto.mjs`, sin vincular esta cuenta administrativa con las cuentas de estudiantes.

`POST /api/auth/login` recibe `username` y `password`, limita los intentos a diez por minuto e inicia una sesión de ocho horas. Emite `lapredigital_session` con HttpOnly, SameSite Strict, ruta `/api` y Secure cuando se usa HTTPS. El servidor conserva solo el hash del token aleatorio en memoria: reiniciarlo cierra las sesiones. Volver a entrar rota el token actual. `GET /api/auth/session` devuelve únicamente usuario/ID o `null`; `POST /api/auth/logout` revoca la sesión y retira la cookie.

El middleware protege las rutas privadas, incluido bootstrap, expedientes, indicadores, documentos y descargas. Conserva las rutas `/api/public/*`, `/api/health` y los webhooks con sus validaciones previas. La restricción de host/origen se comprueba antes del login. No existe registro de usuarios ni gestión de otras cuentas.

## Reglas implementadas

| Área           | Comportamiento                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identidad      | Correo normalizado; teléfono compartido permitido; no fusiona beneficiarios solo por nombre.                                                                             |
| Perfil         | Universidad, carrera, disponibilidad y presupuesto con historial y procedencia humana/agente.                                                                            |
| Prioridad      | Interés, evidencia y contador de intentos entregados con plazo vencido. Consultar precio es Consulta por sí solo.                                                        |
| Consentimiento | Autoriza/revoca por canal y suspende seguimiento sin reiniciar agenda ni reactivar por sí solo prioridad Nula.                                                           |
| Propuesta      | Tarifa vigente; mensaje pendiente; aceptación/rechazo exige evidencia entrante del mismo caso posterior a la entrega.                                                    |
| Contratación   | Términos sobre propuesta aceptada, constancia de pago externo por importe autorizado y validación; conversión atribuida y cierre.                                        |
| Servicio       | Registra habilitación y etapa CUSTOMER, crea/reutiliza cuenta del beneficiario y prepara la entrega cifrada de credenciales; becas separadas.                            |
| Incidencias    | Devolución total invalidante antes de habilitar restaura etapa previa y bloquea promoción; no reabre automáticamente. Registra devolución parcial, disputa y resolución. |
| Responsable    | Invitación y aceptación local con autorización de contacto y vínculo independientes; participación y agenda propias.                                                     |
| Prueba         | Token de uso único con vencimiento; prueba única por beneficiario identificado y finalización periódica.                                                                 |
| Derivación     | Pausa automatización durante atención humana y registra atención/retoma según parámetro.                                                                                 |
| Seguimiento    | Revisa vencimientos, omite intentos bloqueados, expira pruebas y cierra casos inactivos; reapertura/nueva oportunidad según contexto y plazo.                            |

El pago es una constancia del operador sobre una confirmación externa con referencia; no consulta una pasarela. La entrega manual WhatsApp/correo también es una constancia humana. Telegram solo confirma entrega con el identificador del canal; no implica lectura.

## API

La habilitación pagada (`POST /api/cases/:id/activate`) usa `server/access/`: una cuenta por beneficiario en `UsuarioPlataforma`, hash scrypt con sal y un registro de `HabilitacionAcceso` por contratación. La transacción registra cuenta, mensaje y habilitación; los adaptadores envían después del commit. El canal proviene de la aceptación de la propuesta, o de su entrega cuando la aceptación fue en Portal web, y el destinatario es el contacto de la participación que aceptó. El mensaje exige autorización vigente también al despacharse.

La cola confidencial usa AES-256-GCM con `CREDENTIALS_ENCRYPTION_KEY` (32 bytes en base64) y la contratación como contexto autenticado. Solo el hash queda como credencial permanente; el texto cifrado se purga con la confirmación de entrega. Las consultas de expediente exponen usuario, destinatario, canal y estado, sin hash ni contraseña. No se implementa login ni acceso a contenidos educativos.

`POST /api/cases/:id/access-delivery/retry` reintenta un fallo confirmado con otro mensaje, conservando la cuenta y la contraseña. No reintenta entregas inciertas. La entrega de credenciales no admite constancias manuales de entrega externa. Para WhatsApp fuera de 24 horas se requiere la plantilla específica `WHATSAPP_CREDENTIALS_TEMPLATE_NAME`, con una variable de cuerpo; no se sustituye por `hello_world`.

Los esquemas Zod de cada archivo de rutas son la referencia para los cuerpos JSON.

| Ruta                                                                   | Función                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------- |
| GET /api/health, /api/bootstrap                                        | Salud SQL y espacio de trabajo.                         |
| POST /api/leads                                                        | Captación/reutilización.                                |
| POST /api/public/landing                                               | Captación pública desde la landing; ver más abajo.      |
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

## Acceso público y landing

Con `PUBLIC_ORIGIN` definido, el servidor acepta del host público únicamente rutas `/api/public/*`, sin origen o con el propio `PUBLIC_ORIGIN`. `LANDING_ORIGINS` añade páginas de otros orígenes (por ejemplo Vercel) a esa lista: solo ellas reciben cabeceras CORS y respuesta a la verificación previa. La consola, `/api/public-inquiries` y el resto de rutas devuelven 403 fuera de localhost, también con un origen autorizado. Sin `PUBLIC_ORIGIN`, solo localhost. `trust proxy` se limita al bucle local, de modo que la IP del visitante proviene de la cabecera que añade el túnel.

`POST /api/public/landing` acepta nombre, correo, teléfono, rol, beneficiario cuando corresponde, canales autorizados y preferencia Telegram. Guarda mediante `saveLead` en una transacción y devuelve `registered: true` y `recorded: true` solo tras confirmarla. El campo trampa `website` no vacío produce HTTP 400, sin escrituras ni falso éxito; la landing actual no renderiza ni envía ese campo para evitar rechazos por autocompletado del navegador. El cliente también rechaza respuestas no JSON o sin confirmación.

El comprobante incluye el enlace público de WhatsApp y Telegram siempre que estén configurados. Para un registro nuevo se prepara un enlace personal de Telegram aun sin marcar la preferencia; su `consentimiento` es falso en ese caso. Con preferencia marcada, abrirlo e iniciar completa la autorización como antes. Solo los enlaces personales llevan `telegramLinkExpires: true`. Sin configuración, la interfaz mantiene el botón correspondiente deshabilitado.

Para un correo existente se guarda la solicitud para revisar identidad, sin modificar contacto, autorizaciones ni LEADs. El enlace personal se entrega únicamente al correo con SMTP; el botón del comprobante conserva la URL pública del bot. La limitación de reenvío consulta enlaces vigentes con consentimiento solicitado. `telegramEmail` distingue `sent`, `failed` y `pending`; el texto no presupone entrega. Las pruebas usan remitentes simulados y rollback. `useLink` conserva la protección contra reasignación de chats que ya tienen un contacto identificado.

Un contacto nuevo que autoriza Correo y no pide Telegram recibe una confirmación del registro por SMTP. Incluye el enlace público de WhatsApp si está configurado. Se envía después de confirmar la transacción; si SMTP lo acepta, se registra como mensaje por Correo y cumple el primer intento pendiente. Si falla, el registro se conserva y el intento sigue pendiente. No se reenvía al repetir un correo existente. El resto del seguimiento automático continúa limitado a Telegram y WhatsApp.

Al completar la landing por primera vez con autorización de WhatsApp y una participación identificada, se prepara una bienvenida en la misma transacción del registro. Utiliza el intento 1 de la agenda para evitar un segundo aviso genérico del día 0; no depende de que el seguimiento periódico esté activado. Se despacha con el proceso de envíos, después de confirmar la transacción. Repetir el formulario, registrar solo Correo o dejar la identidad en revisión no genera otra bienvenida de WhatsApp.

Fuera de una conversación reciente, la bienvenida requiere `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_WELCOME_TEMPLATE_NAME`, `WHATSAPP_WELCOME_TEMPLATE_LANGUAGE` y `WHATSAPP_WELCOME_TEMPLATE_PARAMETER` (`none`, `name` o `message`). Se consulta el estado real de Meta por nombre e idioma y se reutiliza la comprobación durante un minuto; solo `APPROVED` permite el envío. `hello_world` no se usa como bienvenida. Una plantilla sin configurar, pendiente o rechazada deja el mensaje esperando, sin bloquear otros envíos. Si Meta aprueba la plantilla, las bienvenidas pendientes se procesan automáticamente. La autorización del contacto se comprueba de nuevo al despachar. El registro del formulario no abre la ventana de WhatsApp ni confirma una entrega; esa confirmación llega por webhook.

La plantilla `lapredigital_bienvenida_registro`, en español (`es`), se creó en la cuenta asociada al número configurado. El comprobante de creación y la última consulta de estado se conservan en `docs/whatsapp/bienvenida-meta.json`, sin credenciales. No se envían mensajes de prueba reales durante las verificaciones.

Las tareas de Telegram, WhatsApp, mantenimiento y despacho registran sus errores de forma independiente: un error de mantenimiento no impide despachar respuestas. Tras modificar archivos del backend, reiniciar `npm run up` o `npm start` para que el proceso cargue el código nuevo; la compilación de Vite no recarga un servidor Node que ya estaba abierto. La retoma de derivaciones usa `OUTPUT INTO` para funcionar con los triggers del monitor.

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

El portal del lead está en `/planes`. La captación completa crea o vincula la negociación; los datos incompletos y las coincidencias de identidad quedan pendientes de revisión. La consola muestra las solicitudes web y las provisionales de WhatsApp y Telegram, con acciones para completarlas o abrir la negociación. El agente prepara propuestas y adjunta un enlace personal; la aceptación exige que su entrega ya esté confirmada. El lead ve el precio autorizado, acepta expresamente y puede abrir Checkout en `/oferta/<token>`. La aceptación se registra como mensaje del canal Portal web y su evidencia no se atribuye al operador. `/prueba/<token>` registra la activación expresa de Explora y `/invitacion/<codigo>` permite al responsable aceptar la vinculación y el contacto por separado. Ver [el plan y recorrido de prueba](../docs/plan-agente.md).

En ambos chats, un saludo o «Hola, ya me registré en LaPreDigital» retoma la siguiente pregunta de perfil pendiente, con sus opciones; se conservan los datos ya declarados. Al terminar el registro dentro del chat se inicia el mismo cuestionario de carrera, disponibilidad y presupuesto. Las preguntas opcionales y la recomendación siguen la política configurada del agente.

La conversación comercial en texto libre pasa primero por la IA con el historial, el perfil, las funciones configuradas y los fragmentos recuperados de los documentos activos. Después se validan los datos citados y se comprueban las autorizaciones, tarifas y reglas al ejecutar cada función. El recorrido de familiares usa reglas como respaldo cuando no se obtiene una interpretación del proveedor; el análisis registra el proveedor y el motivo del respaldo. Los botones y comandos explícitos conservan sus validaciones directas. Una consulta informativa durante una invitación no se convierte en el nombre del familiar.

El alta conversacional guarda el contacto y una `SolicitudProvisional` desde el primer mensaje, con el teléfono en WhatsApp o la cuenta del chat en Telegram. `App_Onboarding` conserva el avance y cada dato validado se guarda en `Contacto`; el rol y el beneficiario no se inventan. Se pregunta nombre, correo, teléfono cuando falta, rol, beneficiario cuando corresponde y autorización del canal. El LEAD, el caso y la participación se crean al completar los datos y la autorización. Si el correo ya pertenece a otro contacto, se conserva como dato declarado de la solicitud y esta aparece inmediatamente en **Pendientes → Identidades por confirmar**, sin modificar ni vincular la identidad existente. El operador confirma los datos desde esa pantalla; dos cuentas distintas de Telegram requieren continuar desde la cuenta original.

En WhatsApp y Telegram, «envíale un mensaje a mi padre para que se haga cargo del pago» o «habla con mi apoderado» inicia la vinculación de un familiar, sin convertir la frase en una compra ni retomar el cuestionario. Este recorrido reconoce las solicitudes y recoge nombre, teléfono y relación aun si el proveedor de IA no está disponible; acepta el nombre sin «se llama» cuando ya se están pidiendo esos datos. Solo prepara un envío directo si el teléfono identifica a un único contacto distinto del solicitante, con autorización vigente y canal disponible. Si falta autorización o el canal no permite el envío, explica el impedimento y devuelve `/invitacion/<codigo>` junto con un enlace `wa.me` listo para que el usuario lo comparta. La autorización del usuario que invita no sustituye la del destinatario.

La invitación directa por chat queda pendiente hasta la confirmación del canal y el usuario recibe también el enlace para compartirla. El despacho vuelve a comprobar la autorización y la ventana disponible de WhatsApp; si se revocó el permiso, el envío se bloquea. Los errores confirmados, los resultados inciertos y los estados de rechazo del webhook de WhatsApp generan un único aviso al solicitante con el enlace de respaldo. La metadata de `App_Dispatch` conserva la relación con la invitación y evita repetir el envío o el aviso ante reintentos; no requiere migración. Una invitación en cola o fallida no se considera entregada al consultar el portal.

El comprobante de la invitación ofrece continuar por WhatsApp y Telegram, tanto al aceptar como al recargar una invitación ya vinculada. Solo se otorgan los canales que la persona autorizó; abrir o mostrar otro enlace no agrega consentimiento. El enlace personal de Telegram se prepara al aceptar cuando ese canal fue elegido; al recargar se muestra el enlace público del bot.

Asignar a un familiar la gestión del pago («mi abuelo maneje el pago», «mi padre debe hacer el pago», «mi tía cubre los gastos») también inicia la invitación antes de responder con el catálogo o la pasarela. La validación conserva otras delegaciones interpretadas por IA cuando el mensaje aporta el familiar y el contexto de pago, sin exigir un único verbo; las consultas sobre cómo pagar y las negaciones no asignan un responsable. Durante la recogida de datos, cambiar de familiar reinicia el nombre y teléfono pendientes y confirma con quién se continuará. Se distingue también abuelo de tío aunque ambos usen el rol de apoderado en el OLTP.

Configurar `STRIPE_WEBHOOK_SECRET=whsec_...` además de la clave de prueba. En desarrollo, Stripe CLI puede reenviar los eventos con `stripe listen --forward-to localhost:3067/api/stripe/webhook`; copiar el secreto que muestra a `.env` y reiniciar el servidor. El webhook comprueba firma y antigüedad, recupera la sesión desde Stripe, exige pago, moneda, importe y contratación coincidentes y usa la sesión como referencia idempotente. El regreso del navegador realiza la misma conciliación. [Stripe recomienda procesar eventos del servidor](https://docs.stripe.com/payments/existing-customers?platform=web&ui=stripe-hosted).

La clave `sk_test_...` local respondió correctamente a una consulta de la cuenta Stripe. Falta `STRIPE_WEBHOOK_SECRET`, por lo que no se realizó un pago completo ni una entrega real de webhook. Para compartir `/planes` y `/oferta` fuera del equipo se necesita un dominio HTTPS y un proxy; configurar `PUBLIC_ORIGIN` y `BIND_HOST` según `.env.example`. Mantener las rutas administrativas restringidas a localhost. Antes de publicar ampliamente se requieren protección contra abuso del formulario, verificación de identidad del destinatario y autenticación de operadores.

## Verificación

`npm test` cubre reglas, contratación, consentimiento, reapertura, responsable, pruebas/becas, seguimiento, API HTTP, formato SQL y adaptadores controlados. Las pruebas de negocio usan SQL Server real con rollback obligatorio. No dejan contactos de prueba, aunque consumen IDENTITY. Requieren la base migrada y permisos de lectura/escritura. `npm run build` valida TypeScript; `npm run format:check` comprueba el formato.

En Indicadores, el último filtro modificado resalta las tarjetas cuya medida admite su dimensión y atenúa las demás sin deshabilitarlas. Cada tarjeta distingue filtros aplicados e ignorados. El alcance procede de las dimensiones que devuelve el cálculo del Data Mart: Plan afecta solo L-4.1, Canal no afecta L-5.1 y Contacto/Rol no afectan L-4.1. Periodo afecta a todos; agrupar por año, trimestre, mes o día cambia el desglose temporal. Mientras se recalcula se marca el estado de carga; ante un error se conserva y se identifica el último cálculo confirmado.

La revisión visual automatizada de esta entrega quedó pendiente: ambos controladores fallaron al inicializar con `failed to write kernel assets`. La compilación y las pruebas HTTP no sustituyen esa inspección.

## Alcance pendiente del informe

- Verificar Telegram → SQL → Ollama → respuesta, revocación y selección de beneficiario con cuentas reales; el bot ya está configurado y el servidor escucha.
- Verificar con personas reales el alta F9, los enlaces de Telegram y la aceptación de invitaciones públicas; las pruebas automatizadas usan adaptadores controlados y rollback.
- Prueba real del webhook y Checkout con claves de Stripe, conciliación de reembolsos/disputas y plataforma educativa para aplicar accesos, pruebas y habilitaciones.
- Conectores de WhatsApp/correo. La retoma de una derivación ya prepara un aviso Telegram vinculado al mensaje pendiente.
- Perfil académico ampliado y recorridos excepcionales restantes del informe.
- Autenticación, permisos, auditoría por usuario real, observabilidad y operación de producción.

## DataMart e indicadores

`npm run datamart:init` prepara `LaPreDigital_DataMart` y carga los scripts de `sql/`. `DATAMART_DATABASE` cambia el destino; `DB_DATABASE` conserva la base OLTP. Ambas bases comparten servidor y autenticación.

El modelo usa seis dimensiones con `Key... INT IDENTITY` como PK. Las 28 FK de los hechos referencian exclusivamente esas keys. Los hechos guardan solo keys y M1 a M11; las fechas se obtienen mediante roles de `DimTiempo` y las identidades de conteo se conservan como claves degeneradas. `npm run datamart:rebuild` reemplaza el modelo anterior en una transacción, sin cambiar las tablas OLTP. `init` y `refresh` rechazan el esquema anterior en vez de reinterpretar sus IDs como keys. El diseño está en `docs/modelo-dimensional.md`.

`server/datamart/service.mjs` ejecuta el ETL en una transacción, con bloqueo compartido para lecturas y exclusivo para recargas. `server/kpis/repository.mjs` consulta únicamente los hechos y dimensiones del DataMart. No hay un cálculo alternativo sobre OLTP al fallar esa base. Las reglas de deduplicación conservan contacto-mes para perfil y caso-mes para propuestas, incluso al filtrar por canal o plan. Las becas con M10 = 0 quedan fuera del denominador.

La pantalla y el PDF usan `GET /api/kpis` y `GET /api/kpis/report.pdf`. El botón Actualizar datos llama a `POST /api/kpis/refresh`, equivalente a `npm run datamart:refresh`. El arranque no ejecuta migraciones ni ETL. Para probar la carga completa: `npm run seed:indicators -- --check`; para conservar los ocho casos simulados: `npm run seed:indicators -- --yes`.

Los flujos implementados no equivalen al cumplimiento integral del informe ni a una integración de pagos o aprendizaje en producción.

## WhatsApp (Cloud API de Meta)

Es un canal más del agente, igual que Telegram: el proceso de integraciones recibe los mensajes, el agente los analiza con las mismas reglas y las respuestas salen por el mismo despacho. Se activa con `WHATSAPP_ENABLED=true` y las variables `WHATSAPP_*` de `.env.example`.

- **Webhook:** `GET` y `POST /api/public/whatsapp/webhook` (públicos, por el túnel). El `POST` exige la firma `X-Hub-Signature-256` calculada con `WHATSAPP_APP_SECRET`; el `GET` responde el desafío si coincide `WHATSAPP_VERIFY_TOKEN`. Cada evento se guarda en `App_WhatsAppInbox` con su identificador, así que los reintentos de Meta no duplican nada.
- **Quién escribe:** admite el teléfono (`from`) y el identificador empresarial BSUID (`from_user_id`). Si Meta oculta el teléfono y el BSUID aún no está vinculado, el agente envía el botón nativo para compartir el número. Cuando Meta revela el teléfono, se busca `Contacto.telefono` y se guarda el vínculo en `App_WhatsAppContact`, separado por número empresarial; las siguientes respuestas usan `recipient` con el BSUID completo. No se deduce identidad por nombre ni por tarjetas de terceros reenviadas. Si no hay una coincidencia única por teléfono, se crea una captación provisional y se completan los datos dentro del chat. Un correo ya registrado detiene el alta y requiere confirmación del operador en Pendientes.
- **Números permitidos:** la aplicación no tiene una lista cerrada de teléfonos. La lista de destinatarios de prueba se administra en Meta y no admite un comodín para todos los números. Con un número empresarial real no se agrega a cada cliente a esa lista. Los mensajes sin identificador, remitente válido o tipo se descartan; los eventos incompletos ya guardados se marcan como inválidos para que no bloqueen la cola.
- **Cuestionario:** las preguntas con opciones salen como lista interactiva (máximo 10 opciones y 24 caracteres por opción). La elección llega como mensaje del contacto y se registra una vez.
- **Ventana de 24 horas:** dentro de las 24 horas posteriores al último mensaje del contacto se envía texto libre o lista. Fuera de esa ventana (por ejemplo, un intento de la agenda) solo se puede enviar una plantilla aprobada: `WHATSAPP_TEMPLATE_NAME`. Con `hello_world` se envía sin variables; con una plantilla propia se envía el texto del mensaje como variable `{{1}}` del cuerpo.
- **Primer contacto:** registrarse en la landing no abre la ventana de WhatsApp. El usuario puede iniciar la conversación escribiendo al número empresarial. Para iniciar desde la agenda se necesita una plantilla propia aprobada; Meta rechaza `hello_world` desde números reales con el error 131058. Configurar también el idioma aprobado en `WHATSAPP_TEMPLATE_LANGUAGE`.
- **Entrega:** la API acepta el envío, pero el mensaje solo pasa a Entregado cuando Meta confirma el estado `delivered` o `read` por el webhook; si llega `failed`, queda Fallido.
- **Autorización:** los mensajes de la agenda por WhatsApp exigen una autorización vigente del canal; responder a un mensaje entrante no.

## Recomendación con historial comercial

Rutas privadas: `GET /api/agent/recommendations/settings`, `PATCH /api/agent/recommendations/settings` (`enabled`, `version`) y `POST /api/agent/recommendations/preview` (`career`, `availability`, `budget`, `simulation`). La configuración usa `App_AgentPolicy.useLeadData`, inicialmente desactivada. El mínimo de 50 filas de `Lead` se controla en el servidor, también si se intenta habilitar por `PUT /api/knowledge/policy`. El estado devuelve recuento, mínimo, disponibilidad, preferencia guardada, estado efectivo y versión.

`server/agent/recommendation-repository.mjs` consulta el OLTP: última contratación con pago y validación por beneficiario, carrera y disponibilidad declaradas, excluyendo devoluciones y al estudiante actual. `recommendation-rules.mjs` deduplica estudiantes, exige cinco comparables para citar preferencias, filtra tarifas mensuales que caben en el presupuesto y ordena por elecciones del grupo; sin evidencia suficiente, usa presupuesto. No mide rendimiento ni admisión. `recommendations.mjs` incorpora fragmentos de documentos y `profile-service.mjs` prepara los botones de cada plan. Las decisiones de contratación siguen sus validaciones vigentes.

La vista previa `simulation=true` usa ocho elecciones efímeras ficticias y marca siempre su texto como simulación. Es exclusiva de la consola: el recorrido del bot llama al generador sin simulación. No escribe mensajes ni cambia LEADs, propuestas o invitaciones. El modo real exige la opción activada y el mínimo de datos. Las pruebas del umbral crean 49/50 LEADs dentro de una transacción revertida; no ejecutan el seedeo operativo.

## Documentos y configuración del agente

Aplicar `npm run migrate` y después `npm run knowledge:init`. Este último importa las condiciones, precios, planes y características del catálogo y las explicaciones de los procesos implementados; conserva los documentos ya importados. No es un ETL del Data Mart y no se ejecuta al iniciar el servidor.

| Ruta                                      | Función                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| GET /api/knowledge/documents              | Biblioteca: metadatos sin el archivo binario ni el texto completo.               |
| POST /api/knowledge/documents             | Crea texto editable; título, contenido, fuente, palabras clave y disponibilidad. |
| GET /api/knowledge/documents/:id          | Documento y versión actual.                                                      |
| PATCH /api/knowledge/documents/:id        | Guarda texto, metadatos y disponibilidad, comprobando versión.                   |
| DELETE /api/knowledge/documents/:id       | Elimina documento y fragmentos, comprobando versión.                             |
| POST /api/knowledge/import                | Nombre y base64 de TXT, MD, DOCX o PDF; crea borrador con original.              |
| GET /api/knowledge/documents/:id/original | Descarga el archivo subido, que no cambia al editar su texto.                    |
| POST /api/knowledge/search                | Recupera fragmentos de documentos activos para una consulta.                     |
| GET /api/knowledge/policy                 | Configuración y versión de las decisiones editables.                             |
| PUT /api/knowledge/policy                 | Guarda la configuración completa, comprobando versión.                           |

Son rutas privadas de la consola, limitadas a localhost. La importación admite 2 MB, 200 000 caracteres y PDF de hasta 200 páginas. La extracción ocurre en un proceso hijo con límite de memoria y tiempo: un fallo del lector no cierra la API. No se interpreta HTML, scripts ni instrucciones de los documentos como reglas. El editor muestra texto, y los errores de extracción no crean documentos.

Las respuestas informativas usan solo `App_KnowledgeDocument` activos y sus `App_KnowledgeFragment`. Las palabras clave son opcionales; se comparan también título y contenido. La recuperación es léxica, sin embeddings ni Qdrant. La edición reindexa sin caché y la eliminación retira los fragmentos en la misma transacción. El agente recibe referencias de documento, fragmento y versión. No hay respaldo silencioso hacia JSON, catálogo o conocimiento general.

`App_AgentPolicy` guarda preguntas básicas y su orden, preguntas opcionales, recomendaciones y preparación de enlaces de propuesta, prueba e invitación. Su desactivación se comprueba al ejecutar acciones, también desde botones y al continuar el cuestionario. Los controles no omiten validaciones comerciales ni reemplazan las tarifas operativas de las propuestas. Las preferencias afectan los siguientes pasos; no anulan enlaces ni mensajes anteriores.
