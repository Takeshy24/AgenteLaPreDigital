# LaPreDigital · Gestión de LEADS

Aplicación React/TypeScript con API Express y SQL Server `LaPreDigital_OLTP`. El modo conectado utiliza datos reales; el prototipo anterior está aislado en `src/demo`.

## Ejecutar

Requiere Windows, Node.js 20 o superior, Windows PowerShell/.NET, `sqlcmd` y la base creada con `script/LaPreDigital_OLTP.sql`, un único archivo con el esquema original, las extensiones `App_*` y el usuario de la landing. La conexión predeterminada usa la identidad Windows del proceso.

1. Ejecutar `npm install`.
2. Copiar `.env.example` a `.env` solo si aún no existe y revisar servidor/base.
3. Ejecutar `npm run migrate` para crear o actualizar la base con el script único (es repetible y no borra datos). El servidor no modifica el esquema al arrancar. Con `npm run migrate -- --check` solo muestra qué aplicaría.
4. Ejecutar `npm run build` y `npm start`.
5. Abrir [la aplicación local](http://127.0.0.1:3067).

Para desarrollo: `npm run server` y `npm run dev` en terminales separadas. Vite reenvía `/api` al backend.

## Funcionamiento

- Captación con correo normalizado y participaciones independientes por beneficiario/caso.
- Perfil con historial, conversación, evaluaciones con evidencia y prioridades calculadas por reglas.
- Consentimiento por canal, agenda única, omisión de intentos bloqueados y cierre/reapertura de oportunidades.
- Propuestas con tarifa vigente y aceptación/rechazo vinculados a mensajes posteriores a la entrega.
- Términos, constancia manual de pago externo, validación contractual, habilitación registrada, becas y devoluciones/disputas.
- Vinculación de responsable económico con dos consentimientos, prueba gratuita con token y derivación al personal.
- Adaptador Telegram con vinculación temporal, selección de beneficiario y recepción/envío persistentes.
- Ollama local con salida estructurada y campos respaldados por citas. Las reglas controlan precios, prioridades y operaciones comerciales.

La base vacía se muestra sin registros ficticios. Los recuentos son del OLTP; no representan los KPI del DataMart. Para el prototipo anterior: `VITE_DATA_MODE=demo`; ese modo no escribe en SQL Server.

## Organización y skills

- `src/LiveApp.tsx`, `src/state`, `src/pages`, `src/features`: composición, estado y funciones conectadas.
- `src/components`, `src/shared`, `src/api.ts`: componentes comunes, utilidades y contratos HTTP.
- `src/demo`: demostración aislada.
- `server/<dominio>`: rutas, servicios y repositorios por responsabilidad.
- `server/agent`, `server/integrations`, `server/workers.mjs`: Ollama, Telegram y ejecución periódica.
- `server/db.mjs`, `server/sql-worker.ps1`: SQL parametrizado mediante .NET.
- `script/LaPreDigital_OLTP.sql`: esquema único (original, extensiones `App_*` y usuario de la landing).
- [Skill frontend](.agents/skills/lapredigital-frontend/SKILL.md) y [skill backend](.agents/skills/lapredigital-backend/SKILL.md): criterios utilizados en el refactor.

## Landing pública

Página con video y formulario en `/landing` (`src/pages/Landing.tsx`, `src/features/leads/LandingForm.tsx`; el video está en `public/landing/video.mp4`). El formulario llama a `POST /api/public/landing`, que registra contacto, beneficiario, LEAD, caso, participación, autorizaciones por canal (WhatsApp y correo) y la agenda de intentos con las mismas reglas que la consola. Si el nombre del estudiante ya pertenece a otro contacto, no se vincula: queda una solicitud provisional en `SolicitudProvisional` y la respuesta no revela identificadores.

Telegram en la landing: la casilla «Prefiero conversar por Telegram» no guarda consentimiento, porque el bot no puede escribir primero. Si el correo es nuevo, la respuesta incluye un enlace `https://t.me/<bot>?start=<código>` de un solo uso que vence en 10 minutos; la persona pulsa Iniciar y eso completa la autorización del canal, porque el enlace nació de un formulario donde pidió Telegram: no se le vuelve a pedir ni se le recuerda cómo revocar. `/revocar` y frases como «no me escribas» siguen funcionando. Un correo ya registrado nunca se vincula desde el formulario público: no recibe autorizaciones nuevas, LEAD ni código, y la solicitud queda en «Revisar identidad» para el personal (se muestra en Negociaciones registradas). La respuesta es igual en ambos casos, salvo que a un correo ya registrado se le da el enlace del bot sin código. Requiere `TELEGRAM_BOT_USERNAME` en `.env`; sin él no se devuelve enlace.

Conversación del bot tras vincular: saluda por su nombre y hace preguntas de perfil cortas, una por mensaje y con botones: carrera, disponibilidad y presupuesto mensual. Cada clic se registra como mensaje entrante, guarda el dato con esa evidencia y deja en cola la siguiente pregunta; cada pregunta cuenta como pregunta de perfil del indicador L-2.1. Con las tres respuestas, el agente recomienda el plan mensual más completo que cabe en el presupuesto, tomando precios y topes de las tarifas vigentes, con los botones «Quiero la propuesta», «Probar Explora gratis» y «Ver qué incluye», que pasan por las mismas reglas que un mensaje escrito. Siempre se puede responder escribiendo, y «Otra respuesta» invita a hacerlo. Las opciones de carrera y disponibilidad son atajos editables en `server/agent/profile-flow.mjs`. Las preguntas que el agente hace al leer un mensaje libre también muestran sus botones. Los botones se guardan en `App_Dispatch.markup` y el consentimiento del enlace en `App_TelegramLink.consentimiento`; ambas columnas están en el script SQL único (aplicar con `npm run migrate`).

Correo de verificación (SMTP): si el correo ya existe y la persona pidió Telegram, el enlace con código no se muestra en la página; se envía a ese correo, de modo que solo su dueño lo recibe. Se envía una vez cada 10 minutos por contacto. La respuesta de la página es la misma que en un registro normal. Requiere `SMTP_USER` y `SMTP_PASSWORD` en `.env`; para Gmail, activar la verificación en dos pasos y crear una clave de aplicación en https://myaccount.google.com/apppasswords (se admite con espacios). `SMTP_HOST` (smtp.gmail.com), `SMTP_PORT` (465) y `SMTP_FROM` son opcionales. Sin SMTP configurado se conserva el comportamiento anterior: el correo ya registrado recibe el enlace del bot sin código. Un enlace válido también reemplaza al contacto provisional de un chat que escribió `/start` sin código. Para comprobar la configuración sin enviar nada: `npm run check:mail`; para enviar además un mensaje de prueba a una dirección que tú indiques: `npm run check:mail -- --to correo@ejemplo.com`.

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

Despliegue en Vercel (proyecto `lapredigital-landing`, producción en `https://lapredigital-landing.vercel.app`): se compila en local y solo se sube el resultado estático, de modo que el código fuente, el servidor y el `.env` no salen del equipo. Las variables `VITE_SITE=landing` y `VITE_API_URL=<URL de ngrok>` están en el proyecto de Vercel; deben guardarse sin espacios, saltos de línea ni BOM (en Windows, evitar enviarlas con `echo` o canalización de PowerShell). Para volver a publicar tras un cambio:

```bash
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

`vercel build` puede modificar `package-lock.json` (marcas `peer`); restaurarlo con git si no se pretende cambiarlo. Si cambia el dominio de ngrok, actualizar `VITE_API_URL` en Vercel y `PUBLIC_ORIGIN` en `.env`, y volver a desplegar. La API debe estar en ejecución en el equipo con el túnel abierto; si no, el formulario muestra un error de conexión. El envío está limitado a 8 intentos por minuto y por IP, y el formulario incluye un campo trampa. Siguen pendientes la verificación del correo o teléfono y un servicio antiabuso formal.

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

El recorrido del lead empieza en `/planes`: muestra las tarifas vigentes y guarda solicitudes en una bandeja de revisión. El operador prepara y entrega una propuesta, genera un enlace personal de siete días y lo comparte. En `/oferta/<token>`, el lead acepta el plan y condiciones, abre Stripe Checkout y ve el estado del pago. La confirmación se verifica también mediante webhook firmado. Se requieren `STRIPE_SECRET_KEY=sk_test_...` y `STRIPE_WEBHOOK_SECRET=whsec_...` para probarlo realmente. Quedan pendientes el alojamiento HTTPS, la verificación de identidad y protección contra abuso de formularios públicos, el acceso educativo, WhatsApp/correo, DataMart/ETL y usuarios/permisos de producción.

## Indicadores de la fase LEADS

La consola incluye la página **Indicadores** con los seis KPI del informe (L-1.1, L-1.2, L-2.1, L-3.1, L-4.1 y L-5.1). Se calculan sobre el OLTP con las reglas de las secciones 3.3 a 3.5 (ventana de 168 horas, unidad de conteo propia de cada indicador, denominador cero como «No aplicable» y semáforos propuestos).

- Cada tarjeta muestra el resultado, su semáforo y las medidas M1 a M11. Al expandirla explica qué mide, cómo leer el resultado, por qué las unidades no llegan al numerador y el desglose por tiempo (año, trimestre, mes o día), canal, rol, plan y contacto.
- Los filtros (período, canal, rol, plan y contacto) se aplican solo a los indicadores cuya medida tiene esa dimensión, según la tabla 10 del informe.
- `GET /api/kpis` devuelve los datos y `GET /api/kpis/report.pdf` descarga el reporte en PDF con los mismos filtros (`from`, `to`, `grain`, `contact`, `channel`, `role`, `plan`).
- Las ventanas de 7 días aún abiertas se cuentan, pero el resultado se marca como provisional. Los datos de demostración o pruebas son simulados y deben declararse así.

## Escenarios de prueba que dependen del tiempo

`npm run seed:scenarios` siembra 13 escenarios con fechas pasadas en la base del `.env` (contadores de intentos, Nula y reactivación, reevaluación semanal, derivación de 24 horas, propuesta sin respuesta, Explora vencida, inactividad, reapertura dentro y fuera de plazo, solicitud provisional y ventanas de indicadores cerradas). Pide confirmación (`--yes` la omite) y `--apply` ejecuta la revisión de vencimientos al terminar. Solo inserta registros «Escenario E…» con correos `escenario.e…@example.test`; si ya existen, se niega y hay que limpiar antes con `npm run db:clean -- --local`. La guía de cada escenario está en `docs/casos-de-prueba-leads.md`.
