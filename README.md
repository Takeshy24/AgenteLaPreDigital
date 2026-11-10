# LaPreDigital · Gestión de LEADS

Aplicación React/TypeScript con API Express y SQL Server `LaPreDigital_OLTP`. El modo conectado utiliza datos reales; el prototipo anterior está aislado en `src/demo`.

## Ejecutar

Requiere Windows, Node.js 20 o superior, Windows PowerShell/.NET y la base creada con `script/LaPreDigital_OLTP.sql`. La conexión predeterminada usa la identidad Windows del proceso.

1. Ejecutar `npm install`.
2. Copiar `.env.example` a `.env` solo si aún no existe y revisar servidor/base.
3. Ejecutar `npm run migrate` para aplicar las extensiones. El servidor no modifica el esquema al arrancar.
4. Ejecutar `npm run build` y `npm start`.
5. Abrir [la aplicación local](http://127.0.0.1:3001).

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
- `script/migrations`: extensiones incrementales del esquema original.
- [Skill frontend](.agents/skills/lapredigital-frontend/SKILL.md) y [skill backend](.agents/skills/lapredigital-backend/SKILL.md): criterios utilizados en el refactor.

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

Este repositorio incluye código fuente, migraciones SQL, las skills del proyecto y `package-lock.json`. `.env`, dependencias, compilaciones y copias de base de datos quedan excluidas por `.gitignore`. Cada colaborador debe copiar `.env.example` a `.env` y configurar sus propias credenciales locales; nunca subir el archivo real ni pegar tokens en issues o commits.

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
