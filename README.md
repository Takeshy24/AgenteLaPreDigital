# LaPreDigital · Gestión de LEADS

Aplicación React/TypeScript con API Express y SQL Server `LaPreDigital_OLTP`. El modo conectado utiliza datos reales; el prototipo anterior está aislado en `src/demo`.

## Ejecutar

Requiere Windows, Node.js 22.3 o superior, Windows PowerShell/.NET, `sqlcmd` y la base creada con `script/LaPreDigital_OLTP.sql`, un único archivo con el esquema original, las extensiones `App_*` y el usuario de la landing. La conexión predeterminada usa la identidad Windows del proceso.

1. Ejecutar `npm install`.
2. Copiar `.env.example` a `.env` solo si aún no existe y revisar servidor/base.
3. Ejecutar `npm run migrate` para crear o actualizar la base con el script único (es repetible y no borra datos). El servidor no modifica el esquema al arrancar. Con `npm run migrate -- --check` solo muestra qué aplicaría.
4. Ejecutar `npm run knowledge:init` para importar los documentos iniciales de conocimiento. Es repetible: conserva las versiones existentes.
5. Ejecutar `npm run build` y `npm start`.
6. Abrir [la aplicación local](http://127.0.0.1:3067).

Para desarrollo: `npm run server` y `npm run dev` en terminales separadas. Vite reenvía `/api` al backend.

## Acceso a la consola

El único usuario es `admin` y su contraseña es `password`. `npm run migrate` crea la tabla `dbo.App_AdminUser` e inserta su hash scrypt; repetir la migración conserva la cuenta. Las restricciones permiten una sola fila y el nombre `admin`. `db:clean` conserva este acceso.

La consola requiere iniciar sesión; incluye mostrar/ocultar contraseña y cerrar sesión. La API privada comprueba una cookie HttpOnly con SameSite Strict y una sesión de hasta ocho horas. Las sesiones residen en memoria del servidor y se cierran al reiniciarlo. Un acceso vencido vuelve a mostrar el login. La landing, los enlaces públicos, la salud del servidor y los webhooks mantienen sus propios flujos. La consola continúa limitada a localhost.

## Funcionamiento

- Captación con correo normalizado y participaciones independientes por beneficiario/caso.
- Perfil con historial, conversación, evaluaciones con evidencia y prioridades calculadas por reglas.
- Consentimiento por canal, agenda única, omisión de intentos bloqueados y cierre/reapertura de oportunidades.
- Propuestas con tarifa vigente y aceptación/rechazo vinculados a mensajes posteriores a la entrega.
- Términos, constancia manual de pago externo, validación contractual, habilitación con cuenta del beneficiario y envío de credenciales, becas y devoluciones/disputas.
- Vinculación de responsable económico con dos consentimientos, prueba gratuita con token y derivación al personal.
- Adaptador Telegram con vinculación temporal, selección de beneficiario y recepción/envío persistentes.
- API de OpenAI (ChatGPT) como modelo principal y Ollama local como respaldo automático, ambos con salida estructurada y campos respaldados por citas. Las reglas controlan precios, prioridades y operaciones comerciales.

La base vacía se muestra sin registros ficticios. Los recuentos operativos provienen del OLTP y los indicadores del DataMart. Para el prototipo anterior: `VITE_DATA_MODE=demo`; ese modo no escribe en SQL Server.

## Organización y skills

- `src/LiveApp.tsx`, `src/state`, `src/pages`, `src/features`: composición, estado y funciones conectadas.
- `src/components`, `src/shared`, `src/api.ts`: componentes comunes, utilidades y contratos HTTP.
- `src/demo`: demostración aislada.
- `server/<dominio>`: rutas, servicios y repositorios por responsabilidad.
- `server/agent`, `server/integrations`, `server/workers.mjs`: Ollama, Telegram y ejecución periódica.
- `server/db.mjs`, `server/sql-worker.ps1`: SQL parametrizado mediante .NET.
- `script/LaPreDigital_OLTP.sql`: esquema único (original, extensiones `App_*` y usuario de la landing).
- [Skill frontend](.agents/skills/lapredigital-frontend/SKILL.md) y [skill backend](.agents/skills/lapredigital-backend/SKILL.md): criterios utilizados en el refactor.

## Conocimiento y reglas del agente

**Conocimiento** permite crear, subir, editar, leer, descargar y eliminar documentos. Admite TXT/Markdown UTF-8, DOCX y PDF con texto seleccionable, hasta 2 MB y 200 000 caracteres extraídos (PDF hasta 200 páginas). Los archivos subidos quedan como borradores: revisar el texto y marcar «Disponible para el agente» antes de guardar. Se edita el texto extraído; el archivo original se conserva por separado. Un PDF escaneado necesita OCR externo.

La misma base SQL Server `LaPreDigital_OLTP` conserva documentos y originales en `App_KnowledgeDocument`, y sus fragmentos en `App_KnowledgeFragment`. El Data Mart no interviene. Guardar reindexa en una transacción; eliminar retira también los fragmentos; las versiones detectan ediciones simultáneas. `db:clean` conserva documentos y reglas.

Las respuestas informativas del agente, incluso en el registro sin consentimiento y las fichas de recomendación, salen exclusivamente de los documentos activos. Si no encuentra información, lo indica. Los JSON del informe y las tarifas solo sirven como fuente de la importación inicial explícita; no se consultan como respaldo para responder. La importación incluye condiciones, precios, cuatro planes, características y procesos de atención. Repetirla agrega únicamente fuentes iniciales ausentes: no sobrescribe las ediciones, pero puede volver a crear un documento inicial eliminado. No se ejecuta al arrancar.

La búsqueda actual recorre los fragmentos de todos los documentos activos, compara palabras del título, texto y palabras clave opcionales, y entrega al modelo los fragmentos más relacionados, con documento y versión. Las palabras clave ayudan con sinónimos; no son obligatorias. No lee todos los documentos completos en cada mensaje ni usa embeddings. «Probar consulta» permite comprobar la recuperación. SQL Server evita otra dependencia para esta biblioteca; Qdrant tendría sentido como índice vectorial futuro si se incorporan embeddings y búsqueda semántica. No se instaló Qdrant.

**Reglas del agente** guarda su configuración en `App_AgentPolicy`: preguntas básicas y su orden, preguntas opcionales, recomendación al completar el perfil y preparación automática de propuestas, pruebas e invitaciones. Desactivar un tipo de enlace deriva esa solicitud al equipo; no envía mensajes al guardar. Las decisiones de intención están en `server/agent/intents.mjs`; su ejecución, en `server/agent/service.mjs`; el cuestionario, en `profile-flow.mjs` y `profile-service.mjs`; configuración, en `policy.mjs`. Las comprobaciones de identidad, autorización, aceptación y pago siguen siendo obligatorias.

Los precios de los documentos son informativos y editables. Las propuestas y cobros se validan con `PlanTarifa` y los registros transaccionales: editar un documento no cambia una tarifa. Al modificar precios, mantener coherencia entre el documento publicado y el catálogo. Los hechos del caso (pago confirmado, estado, enlace personal) proceden de sus registros operativos, no del contenido documental.

## Recomendaciones con datos

En **Agente e integraciones** (antes Telegram e IA), el interruptor «Usar el historial de LEADs para recomendar» guarda `useLeadData` en `App_AgentPolicy`. Solo se puede activar con al menos 50 filas reales registradas en la tabla `Lead`; no cuenta solicitudes provisionales ni participaciones como LEADs adicionales. El servidor comprueba el mínimo al activar y al recomendar. Si baja el recuento, el uso del historial se pausa aunque la preferencia estuviera guardada.

Con el modo desactivado, sigue la recomendación por perfil y presupuesto. Con el modo activado, compara hasta tres modalidades mensuales vigentes que caben en el presupuesto. Ordena por elecciones de estudiantes con la misma carrera; utiliza también la disponibilidad si hay al menos cinco perfiles coincidentes. Solo atribuye preferencias con cinco estudiantes comparables distintos, tomando la última contratación pagada y validada de cada estudiante y excluyendo devoluciones. Excluye al propio estudiante del historial. Sin suficiente historial comparable, prioriza el presupuesto y lo indica. La recomendación aparece al completar el perfil y al pedir una recomendación con los datos básicos disponibles.

Los beneficios y precios explicativos siguen viniendo de los documentos activos de Conocimiento. Los botones permiten consultar o elegir cada alternativa, respetando las reglas de propuestas, pruebas y autorizaciones. Las compras registradas son evidencia de elecciones comerciales, no de ingreso a la UNT ni de resultados académicos.

«Probar cómo respondería el agente» permite una vista previa con historial registrado cuando está habilitado, o un ejemplo con ocho elecciones ficticias marcado **EJEMPLO SIMULADO**. La simulación funciona con menos de 50 LEADs, no se envía a contactos y no crea ni modifica registros operativos.

El botón **Empezar mi preparación** de la landing abre la página oficial indicada: https://la-pre-digital.onrender.com/.

## Cuentas al habilitar el servicio

Solo **Registrar habilitación** de una contratación pagada y validada crea o reutiliza la cuenta del estudiante en `UsuarioPlataforma`. `HabilitacionAcceso` vincula la contratación, la cuenta y el mensaje de entrega. Una cuenta existente conserva su contraseña; repetir el botón no duplica usuarios ni envíos. Las becas conservan su flujo separado.

La entrega se dirige al contacto que aceptó la contratación. Se usa el canal de su aceptación y, si aceptó en el portal web, el canal por el que se entregó la propuesta. Correo usa SMTP; Telegram y WhatsApp usan sus adaptadores. Pendientes distingue mensajes en cola, fallidos, inciertos y entregados. Los fallos confirmados permiten reintentar; una entrega incierta exige comprobar el canal para evitar duplicados. En el expediente, Servicio muestra si hay una compra confirmada y permite habilitarla si aún está pendiente.

`CREDENTIALS_ENCRYPTION_KEY` es una clave aleatoria de 32 bytes en base64, almacenada solo en `.env`; debe conservarse mientras existan envíos pendientes. La contraseña se guarda como hash scrypt con sal. El mensaje de entrega se cifra y se elimina al confirmar la entrega; el historial y la API no muestran la clave. Fuera de la ventana de WhatsApp se requiere `WHATSAPP_CREDENTIALS_TEMPLATE_NAME`, una plantilla aprobada con una variable de cuerpo para el texto de acceso; `hello_world` no sirve.

Este registro no añade una plataforma educativa ni un inicio de sesión. `requiereCambioClave` deja indicado que la contraseña inicial es provisional para una integración posterior. Las pruebas usan adaptadores controlados y rollback, sin enviar credenciales a personas reales.

## Landing pública

Página con video y formulario en `/landing` (`src/pages/Landing.tsx`, `src/features/leads/LandingForm.tsx`; el video está en `public/landing/video.mp4`). El formulario llama a `POST /api/public/landing`, que registra contacto, beneficiario, LEAD, caso, participación, autorizaciones por canal (WhatsApp y correo) y la agenda de intentos con las mismas reglas que la consola. Si el nombre del estudiante ya pertenece a otro contacto, no se vincula: queda una solicitud provisional en `SolicitudProvisional` y la respuesta no revela identificadores.

El comprobante exige `registered: true` y `recorded: true`, emitidos después de confirmar la transacción SQL. Una respuesta HTML, un JSON incompleto o un fallo de registro no muestra éxito. Siempre presenta WhatsApp y Telegram; si falta la configuración de un canal, su botón queda deshabilitado con una explicación. La consola refresca solicitudes y LEADs cada diez segundos mientras está visible y al recuperar el foco.

Telegram en la landing: un registro nuevo recibe un enlace personal de un uso y diez minutos aunque no marque Telegram. Marcar «Prefiero conversar por Telegram» deja indicado en ese enlace que abrirlo y pulsar Iniciar completa la autorización; sin marcarlo, el bot debe pedir autorización. Ver el botón no autoriza seguimiento. Para correos existentes se conserva la revisión de identidad: el botón abre el bot sin código y el enlace personal solo se envía al correo, cuando corresponde. El comprobante distingue correo enviado, envío fallido y enlace pendiente; no afirma que se envió un correo sin confirmación del adaptador. Requiere `TELEGRAM_BOT_USERNAME`; WhatsApp usa `WHATSAPP_PUBLIC_NUMBER`.

Conversación del bot tras vincular: saluda por su nombre y hace preguntas de perfil cortas, una por mensaje y con botones: carrera, disponibilidad y presupuesto mensual. Cada clic se registra como mensaje entrante, guarda el dato con esa evidencia y deja en cola la siguiente pregunta; cada pregunta cuenta como pregunta de perfil del indicador L-2.1. Con las tres respuestas, el agente recomienda el plan mensual más completo que cabe en el presupuesto, tomando precios y topes de las tarifas vigentes, con los botones «Quiero la propuesta», «Probar Explora gratis» y «Ver qué incluye», que pasan por las mismas reglas que un mensaje escrito. Siempre se puede responder escribiendo, y «Otra respuesta» invita a hacerlo. Las opciones de carrera y disponibilidad son atajos editables en `server/agent/profile-flow.mjs`. Las preguntas que el agente hace al leer un mensaje libre también muestran sus botones. Los botones se guardan en `App_Dispatch.markup` y el consentimiento del enlace en `App_TelegramLink.consentimiento`; ambas columnas están en el script SQL único (aplicar con `npm run migrate`).

Correo de registro y verificación (SMTP): un contacto nuevo que autoriza Correo recibe una confirmación aunque no elija Telegram. Si pide Telegram, recibe el enlace con código en ese correo. El envío aceptado por SMTP cumple el primer intento pendiente cuando existe autorización de Correo; reenviar un formulario con un correo existente no duplica la confirmación ni las autorizaciones. Si el correo ya existe y la persona pidió Telegram, el enlace con código no se muestra en la página; se envía a ese correo, de modo que solo su dueño lo recibe, una vez cada 10 minutos por contacto. Requiere `SMTP_USER` y `SMTP_PASSWORD` en `.env`; para Gmail, activar la verificación en dos pasos y crear una clave de aplicación en https://myaccount.google.com/apppasswords (se admite con espacios). `SMTP_HOST` (smtp.gmail.com), `SMTP_PORT` (465) y `SMTP_FROM` son opcionales. Sin SMTP configurado no se envía confirmación y el correo ya registrado recibe el enlace del bot sin código. Un enlace válido también reemplaza al contacto provisional de un chat que escribió `/start` sin código. Para comprobar la configuración sin enviar nada: `npm run check:mail`; para enviar además un mensaje de prueba a una dirección que tú indiques: `npm run check:mail -- --to correo@ejemplo.com`.

Limpiar la base antes de probar formularios: `npm run db:clean -- --local | --remote | --global`. El ámbito es obligatorio; sin él no hace nada. `--local` limpia la base de esta PC (`DB_SERVER` y `DB_DATABASE`), `--remote` (o `--remoto`) limpia otra base configurada aparte (`REMOTE_DB_SERVER`, `REMOTE_DB_DATABASE`, `REMOTE_DB_USER` y `REMOTE_DB_PASSWORD`; el servidor puede llevar puerto, por ejemplo `host,1433`) y `--global` limpia las dos. Muestra cuántas filas se borrarían por tabla y pide escribir el ámbito (LOCAL, REMOTO o GLOBAL); con `--yes` no pregunta. Se niega si falta la configuración remota, y `--global` aborta antes de tocar nada si local y remota son en realidad la misma base, aunque se nombren distinto. Borra contactos, LEADs, casos, mensajes, eventos, solicitudes, vínculos de Telegram y el resto de datos de uso, reinicia los identificadores en 1 y se puede repetir. Conserva catálogos, parámetros, planes, tarifas, operadores y el cursor de Telegram. Desactiva solo durante la limpieza los triggers que impiden borrar eventos y evaluaciones, dentro de una transacción, y los vuelve a activar. Puede ejecutarse con el servidor encendido y requiere `sqlcmd`. El script está en `script/limpiar_datos.sql`.

Variables de `.env`:

| Variable          | Efecto                                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_ORIGIN`   | URL del túnel ngrok. Habilita solo `/api/public/*` para ese host; la consola y el resto de la API siguen limitadas a localhost. Vacío: solo trabajo local. |
| `LANDING_ORIGINS` | Páginas alojadas en otro origen (por ejemplo Vercel) autorizadas a llamar a `/api/public/*`, separadas por coma.                                           |
| `VITE_API_URL`    | Frontend. Vacío usa la API del mismo origen (local). Con la URL de ngrok, la página usa la API pública.                                                    |
| `VITE_SITE`       | Con `landing`, la ruta `/` muestra la landing. Se usa en el despliegue de Vercel.                                                                          |

Levantar todo con un solo comando: `npm run up`. Comprueba que el puerto esté libre, inicia Ollama si no responde, compila la interfaz, arranca el servidor (con Telegram y la agenda según `.env`) y abre el túnel ngrok con el dominio de `PUBLIC_ORIGIN`. Ctrl+C detiene servidor y túnel. `npm run up:check` valida lo anterior sin arrancar nada. Si `PUBLIC_ORIGIN` está vacío, `up` funciona solo en local y no abre túnel. Requiere detener antes cualquier otro `npm start` que use el mismo puerto.

Trabajo local sin túnel: comentar `PUBLIC_ORIGIN` y `LANDING_ORIGINS`, dejar `VITE_API_URL` vacío y ejecutar `npm run up`; la landing queda en `http://127.0.0.1:3067/landing`. Para desarrollar la interfaz: `npm run server` y `npm run dev` en terminales separadas.

Monitorear cambios de registros: `npm run db:watch`. Usa `DB_SERVER`, `DB_DATABASE` y la autenticación del `.env`; instala triggers de monitoreo y muestra por registro CREADO, EDITADO o ELIMINADO, tabla, clave primaria, usuario SQL y hora de Lima. Detecta cambios confirmados desde la aplicación, SSMS u otra conexión y consulta la cola cada segundo. Los avisos contienen las claves, sin copiar los demás campos. `Ctrl+C` retira los triggers y la cola; solo puede existir un monitor por base. Requiere permisos para crear tablas y modificar las tablas vigiladas. Para comprobar la conexión sin instalar nada: `npm run db:watch -- --check`.

El monitor cubre las tablas existentes al arrancar: reiniciarlo si se crean tablas nuevas. No captura `TRUNCATE TABLE`, cambios de estructura ni cargas masivas sin `FIRE_TRIGGERS`. Si se cierra la terminal a la fuerza, los triggers residuales dejan de registrar al perderse la conexión; el siguiente arranque los reutiliza y `npm run db:watch -- --uninstall` los retira. La limpieza `db:clean` conserva la cola para poder mostrar también sus eliminaciones.

Despliegue en Vercel (proyecto `lapredigital-landing`, producción en `https://lapredigital-landing.vercel.app`): se compila en local y solo se sube el resultado estático, de modo que el código fuente, el servidor y el `.env` no salen del equipo. Las variables `VITE_SITE=landing` y `VITE_API_URL=<URL de ngrok>` están en el proyecto de Vercel; deben guardarse sin espacios, saltos de línea ni BOM (en Windows, evitar enviarlas con `echo` o canalización de PowerShell). Para volver a publicar tras un cambio:

```bash
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

`vercel build` puede modificar `package-lock.json` (marcas `peer`); restaurarlo con git si no se pretende cambiarlo. Si cambia el dominio de ngrok, actualizar `VITE_API_URL` en Vercel y `PUBLIC_ORIGIN` en `.env`, y volver a desplegar. La API debe estar en ejecución en el equipo con el túnel abierto; si no, el formulario muestra un error de conexión. El envío está limitado a 8 intentos por minuto y por IP, y el formulario no incluye campos ocultos que puedan autocompletarse accidentalmente. La API conserva la compatibilidad con el filtro `website` para clientes antiguos; la landing actual no lo envía. Siguen pendientes la verificación del correo o teléfono y un servicio antiabuso formal.

## Comprobaciones

```bash
npm run format
npm run format:check
npm test
npm run build
npm run check:ollama
```

El último comando consulta Ollama real y requiere el modelo disponible. Las pruebas de negocio usan SQL Server con rollback obligatorio; pueden dejar saltos normales de IDENTITY. Los adaptadores se prueban con transporte controlado. Prettier organiza el código web y el formateador T-SQL conserva los separadores `GO`.

## Subir el código a GitHub

Este repositorio incluye código fuente, el script SQL único, las skills del proyecto y `package-lock.json`. `.env`, dependencias, compilaciones y copias de base de datos quedan excluidas por `.gitignore`. Cada colaborador debe copiar `.env.example` a `.env` y configurar sus propias credenciales locales; nunca subir el archivo real ni pegar tokens en issues o commits.

Después de crear un repositorio vacío en GitHub, desde esta carpeta:

```bash
git status
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

El proyecto requiere Windows y SQL Server para ejecutar el backend actual. Las pruebas de integración necesitan la base creada y migrada. GitHub Actions ejecuta formato y compilación sin credenciales; las pruebas de base de datos continúan siendo locales.

## Integraciones y alcance

Ollama fue probado con `llama3.2:3b`. Puede omitir o interpretar mal campos; el análisis tiene revisión humana. Telegram está configurado con un bot real y su identidad fue verificada mediante `getMe`. El servidor recibe actualizaciones por long polling; falta comprobar una conversación iniciada desde una cuenta Telegram. El procedimiento está en [la guía del backend](server/README.md).

El recorrido del lead empieza en `/planes`: muestra las tarifas vigentes y guarda solicitudes en una bandeja de revisión. El operador prepara y entrega una propuesta, genera un enlace personal de siete días y lo comparte. En `/oferta/<token>`, el lead acepta el plan y condiciones, abre Stripe Checkout y ve el estado del pago. La confirmación se verifica también mediante webhook firmado. Se requieren `STRIPE_SECRET_KEY=sk_test_...` y `STRIPE_WEBHOOK_SECRET=whsec_...` para probarlo realmente. Quedan pendientes el alojamiento HTTPS, la verificación de identidad y protección contra abuso de formularios públicos, el acceso educativo, WhatsApp/correo y usuarios/permisos de producción.

## Indicadores de la fase LEADS

La consola incluye la página **Indicadores** con los seis KPI del informe (L-1.1, L-1.2, L-2.1, L-3.1, L-4.1 y L-5.1). La pantalla y el PDF leen las cinco tablas de hechos de `LaPreDigital_DataMart`, con las reglas de las secciones 3.3 a 3.5 (ventana de 168 horas, unidad de conteo propia de cada indicador, denominador cero como «No aplicable» y semáforos propuestos).

Preparar y cargar la base una vez con `npm run datamart:init`. El comando crea únicamente los objetos que faltan y ejecuta los ETL de `sql/`. Para incorporar cambios posteriores, usar **Actualizar datos** en Indicadores o `npm run datamart:refresh`. La carga de dimensiones y hechos se confirma en una sola transacción; las consultas esperan a que termine. Los cambios de filtros y la descarga del PDF solo leen los datos cargados. El servidor no crea el DataMart al arrancar y nunca sustituye sus datos por cálculos sobre el OLTP.

`DB_DATABASE` sigue apuntando al OLTP. `DATAMART_DATABASE` permite cambiar el destino, en el mismo servidor SQL. Por defecto se utiliza `LaPreDigital_DataMart`; con un OLTP cuyo nombre termina en `_test`, se utiliza `LaPreDigital_DataMart_test`.

Las dimensiones tienen PK `Key... IDENTITY` y los hechos contienen solo keys y medidas. Todas las relaciones usan las keys sustitutas; los IDs del OLTP se resuelven en el ETL. Para reemplazar el modelo anterior se utiliza `npm run datamart:rebuild`, que reconstruye únicamente las tablas del DataMart y las recarga en una transacción. El [diccionario dimensional](docs/modelo-dimensional.md) describe las claves de negocio, las claves degeneradas de conteo y los roles de tiempo que conservan las 168 horas exactas.

- Cada tarjeta muestra el resultado, su semáforo y las medidas M1 a M11. Al expandirla explica qué mide, cómo leer el resultado, por qué las unidades no llegan al numerador y el desglose por tiempo (año, trimestre, mes o día), canal, rol, plan y contacto.
- Los filtros (período, canal, rol, plan y contacto) se aplican solo a los indicadores cuya medida tiene esa dimensión, según la tabla 10 del informe.
- `GET /api/kpis` devuelve los datos y `GET /api/kpis/report.pdf` descarga el reporte en PDF con los mismos filtros (`from`, `to`, `grain`, `contact`, `channel`, `role`, `plan`).
- `POST /api/kpis/refresh` recarga las seis dimensiones y los cinco hechos. El canal técnico Portal web no se ofrece como dimensión de contacto.
- Las ventanas de 7 días aún abiertas se cuentan, pero el resultado se marca como provisional. Los datos de demostración o pruebas son simulados y deben declararse así.

## Escenarios de prueba que dependen del tiempo

Proveedor del agente: si `.env` tiene `OPENAI_API_KEY`, cada mensaje se analiza primero con OpenAI (`OPENAI_MODEL`, por defecto `gpt-4o-mini`, salida JSON estricta). Si OpenAI no responde, devuelve un error o supera `OPENAI_TIMEOUT_MS`, el mismo mensaje se analiza con Ollama local. Sin clave, o con `OPENAI_ENABLED=false`, solo se usa Ollama. El proveedor y el modelo usados quedan en `App_AgentAnalysis`. Con OpenAI, el texto del mensaje y el historial reciente salen del equipo. Las pruebas automáticas nunca llaman a OpenAI.

`npm run eval:agent` mide al agente con el proveedor configurado (o el que indique `-- --provider openai|ollama`) sobre 99 mensajes etiquetados según el informe (nivel de interés, derivación, perfil, responsable, objeciones, rechazo y aceptación); `-- --holdout` usa 36 mensajes reservados y `-- --runs 2` repite cada caso. Solo lee el catálogo de la base. Las respuestas sobre planes salen de `server/agent/knowledge.mjs` (PlanTarifa, `src/shared/offer.json` y `server/agent/knowledge/conditions.json`).

`npm run seed:scenarios` siembra 13 escenarios con fechas pasadas en la base del `.env` (contadores de intentos, Nula y reactivación, reevaluación semanal, derivación de 24 horas, propuesta sin respuesta, Explora vencida, inactividad, reapertura dentro y fuera de plazo, solicitud provisional y ventanas de indicadores cerradas). Pide confirmación (`--yes` la omite) y `--apply` ejecuta la revisión de vencimientos al terminar. Solo inserta registros «Escenario E…» con correos `escenario.e…@example.test`; si ya existen, se niega y hay que limpiar antes con `npm run db:clean -- --local`. La guía de cada escenario está en `docs/casos-de-prueba-leads.md`.

El seed complementario `npm run seed:indicators -- --yes` agrega ocho casos y diez contactos identificados como simulados, y recarga el DataMart. Cubre las cinco tablas de hechos, múltiples preguntas y planes, autorizaciones históricas, becas, reembolsos y una validación un segundo fuera de plazo. Repetirlo no duplica escenarios. `npm run seed:indicators -- --check` valida los datos y el ETL dentro de una transacción que se revierte. La guía y los resultados esperados están en [docs/seed-indicadores.md](docs/seed-indicadores.md).
