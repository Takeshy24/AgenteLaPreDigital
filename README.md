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
