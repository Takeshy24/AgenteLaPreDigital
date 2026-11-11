# Modificaciones a reflejar en el informe LEADS (v27)

Fecha de revisión: 10 de noviembre de 2026. Fuente comparada: `Informe_LEADS_LaPreDigital_David_Takeshy_Business_Intelligence_v27.docx` (secciones 1 a 4 redactadas; 5 a 9 son marcadores por completar) frente al repositorio actual.

Cada punto indica la sección del informe donde va y de qué tipo es: **Nuevo** (la sección está vacía o no lo menciona), **Ajustar** (el texto actual no coincide del todo con lo implementado) o **Aclarar** (coincide, pero conviene precisarlo). Lo que no está verificado en ejecución real se declara como tal.

## 1. Resumen

El informe define el modelo; el prototipo ya lo implementa de punta a punta con estos añadidos: landing pública con captación y vinculación a Telegram, agente local con Ollama y reglas explícitas, oferta pública con pago de prueba en Stripe y una consola para el personal comercial. Las secciones 5 a 9 del informe se escriben con lo que sigue. Los cambios que modifican el texto de las secciones 2 a 4 son pocos (sección 3).

## 2. Contenido para las secciones por completar (5 a 9)

### 5.1–5.4 Modelo transaccional (OLTP)

- **Nuevo.** Base `LaPreDigital_OLTP` en SQL Server: **76 tablas** = 61 del modelo del informe (catálogos `Cat_*`, parámetros `Param_*` y entidades de F1 a F9) + **15 tablas `App_*`** de apoyo que no son formatos del informe: `App_TelegramChat`, `App_TelegramLink`, `App_TelegramInbox`, `App_Dispatch`, `App_IntegrationCursor`, `App_ContactSelection`, `App_TrialLink`, `App_OperationEvidence`, `App_ContractSnapshot`, `App_Scholarship`, `App_AgentAnalysis`, `App_PublicOffer`, `App_PublicInquiry`, `App_Onboarding`, `App_AgentFailures`.
- **Nuevo.** 9 triggers: correo único de contacto, un solo caso abierto por beneficiario, una sola autorización vigente por contacto y canal, precio de tarifa inmutable, evaluaciones y eventos de solo inserción (más su actualización de la participación y del caso/etapa) y clave única de solicitud pública.
- **Nuevo.** Parámetros en `Param_Proceso`: `UMBRAL_BAJA` 3, `UMBRAL_NULA` 7, `REEVALUACION_DIAS` 7, plazos de respuesta de 7 días y agenda de intentos en `Param_AgendaIntento` (días 0, 1, 2, 5, 10, 17 y 27).
- **Ajustar (5.4).** La sección pide scripts con "índices". El script no tiene índices explícitos: la unicidad se resuelve con restricciones `UNIQUE` y triggers. Conviene decirlo para que no parezca una omisión.
- **Nuevo.** El script es un único archivo, repetible, con solo CREATE, triggers e INSERT de catálogos y parámetros, **sin ALTER** (detalle en la sección 4 de este documento).

### 6. DataMart

No se implementó. Declararlo en 6 y 9.2; no hay estrella, ETL ni consultas de los seis KPI. El OLTP conserva los datos necesarios (fechas originales, evaluaciones, eventos, mensajes con canal y entrega).

### 7.1 Arquitectura técnica

- **Nuevo.** React + Vite (consola del operador y landing/portal públicos) → servidor Express 5 → SQL Server. Las escrituras van siempre al OLTP.
- **Nuevo.** Dos superficies: la consola (local) y la pública (`/api/public/*`), expuesta por túnel ngrok. Con `PUBLIC_ORIGIN` configurado, el servidor solo acepta rutas públicas desde el dominio del túnel. La landing alojada en Vercel llama a la API pública con lista de orígenes permitidos (CORS) y límite de peticiones en memoria.
- **Nuevo.** Un proceso de integraciones (worker) con bloqueo exclusivo en SQL Server para que no corran dos a la vez: sondea Telegram, ejecuta la revisión de seguimiento y despacha los mensajes pendientes.
- **Nuevo.** Comandos: `npm run up` (levanta todo), `npm run migrate`, `npm run db:clean` (limpia datos con alcance local, remoto o ambos) y `npm test`.

### 7.2 Modelo de IA, instrucciones y herramientas

- **Nuevo.** Modelo local `llama3.2:3b` vía Ollama, con salida JSON estructurada: nivel de interés, retractación, acción sugerida, tarifa, campos del perfil con la cita textual, necesidad de responsable y si entendió el mensaje.
- **Nuevo.** El modelo solo propone. Una capa de reglas valida cada salida antes de usarla: la cita debe aparecer en el mensaje; el presupuesto debe ser numérico y estar en la cita; el nivel Compra exige palabras de contratación; la tarifa debe existir en el catálogo; una derivación sin motivo claro se degrada. Si el modelo no entiende, el sistema responde con una pregunta fija.
- **Nuevo.** Las respuestas del agente son plantillas con datos del catálogo; no hay texto libre generado por el modelo. Esto impide que el agente invente precios, descuentos o medios de pago (coherente con F5 y 2.2).
- **Nuevo.** L-2 con botones: pregunta carrera, disponibilidad y presupuesto (en ese orden), una por mensaje, con opciones rápidas y la posibilidad de escribir otra respuesta. El presupuesto ofrece topes tomados de las tarifas vigentes. Con el perfil completo, el sistema recomienda el plan mensual más completo que cabe en el presupuesto declarado, e incluye Explora UNT. Cada pregunta queda en `PreguntaPerfil` y cada respuesta en `CambioPerfil`, de modo que sustentan M4 y M5.
- **Nuevo.** Teclado de respuesta de Telegram: al pulsar una opción, el texto sale en el chat como mensaje del propio contacto y se registra una sola vez como mensaje entrante.
- **Nuevo.** Derivación al personal comercial: por palabras clave (persona, reclamo, reembolso, disputa, descuento, beca) o tras dos mensajes seguidos que no se interpretan.
- **Aclarar.** El agente no modifica prioridad, estado de participación ni estado del caso. El sistema calcula la prioridad con el orden de 2.5 y registra cada evaluación.

### 7.3 Flujos funcionales

- **Nuevo.** Captación por la landing: nombre, correo, teléfono, rol, beneficiario (si el contacto no es el estudiante), canales autorizados y casilla para continuar por Telegram. Validación y normalización del teléfono (+51 por defecto), campo trampa contra bots y límite de peticiones.
- **Nuevo.** Vinculación a Telegram con enlace `t.me/<bot>?start=<código>`: de un solo uso, vence en 10 minutos y solo se guarda su hash. Si el formulario pidió Telegram, abrirlo y pulsar Iniciar equivale a la autorización de ese canal (versión de texto `landing-telegram-v1`).
- **Nuevo.** Un remitente de Telegram sin vínculo sigue el flujo de F9: solicitud provisional y recogida de datos por el chat (onboarding).
- **Nuevo.** Oferta pública (`/oferta/<token>`): enlace personal con vigencia de 7 días y solo su hash guardado. El lead acepta propuesta y condiciones en esa página; se registra un mensaje entrante por el canal **Portal web**, el resultado Aceptada y la aceptación de condiciones. Luego paga y el personal valida.
- **Nuevo.** Pago con Stripe Checkout **solo en modo de prueba** (se exige clave `sk_test_`, moneda PEN). Se confirma consultando a Stripe al volver (importe, moneda, estado pagado y caso) y también por webhook con firma y antigüedad máxima de 5 minutos. La validación de la contratación la hace siempre el personal.

### 7.4 Integración con OLTP y seguridad

- **Nuevo.** Secretos solo en `.env` (ignorado por git). Enlaces de Telegram, de prueba y de oferta guardan solo su hash SHA-256. Despacho de mensajes con reclamo exclusivo para no enviar dos veces, y respeto del bloqueo promocional, de la derivación y de la autorización antes de cualquier envío proactivo.
- **Nuevo.** Cada actualización de Telegram se guarda en una bandeja con su identificador y se procesa una sola vez.
- **Ajustar.** La consola no tiene autenticación de usuarios (opera como un operador local). Declararlo en 9.2.

### 7.5 Evidencias

Capturas disponibles de la consola (panel de datos del lead, avance de propuesta, prioridad, agenda), del chat de Telegram, de la oferta pública y del pago de prueba. No se incluye conversación ni pago reales.

### 8 Evaluación

- **Nuevo.** 68 pruebas automatizadas (`npm test`, Node test runner) contra SQL Server real con rollback. Cubren captación, vinculación, agente, perfil, seguimiento, Stripe, oferta pública y reglas del informe.
- **Aclarar (8.3).** No se calcularon los seis KPI. Cualquier dato de la demo es simulado y debe marcarse así (ver pago simulado en la sección 3).

### 9.2 Limitaciones que declarar

- DataMart y ETL sin implementar; los KPI no se calculan.
- WhatsApp no está integrado (pospuesto: requiere cuenta de Meta y número verificado). Los canales operativos son correo y Telegram.
- Pago solo en modo de prueba de Stripe; no hay cobros reales.
- Sin autenticación de operadores ni permisos por usuario.
- El perfil captura carrera, disponibilidad y presupuesto. Las tablas de cursos difíciles, postulaciones anteriores y objeciones comerciales existen pero no se llenan todavía (decisión: se mantienen).
- Modelo pequeño (3B) y sensible a la memoria disponible: la primera respuesta puede tardar y a veces no interpreta mensajes ambiguos (ver hallazgos).
- Los límites de peticiones están en memoria y se reinician con el servidor.

## 3. Cambios que modifican el texto actual de las secciones 2 a 4

1. **2.1 y 2.2, fila "Ingreso a LEAD" (Ajustar).** El informe dice que un contacto existente se reconoce por su correo y se reutiliza. En el formulario público, un correo ya registrado **no** se vincula automáticamente: no prueba que quien escribe sea su dueño y dejaría autorizaciones y LEADS a nombre de otra persona. Se guarda una solicitud en estado **"Revisar identidad"** (una por correo y beneficiario) para que el personal la confirme, y el enlace de Telegram solo viaja al correo registrado. Esto es coherente con la regla de confirmación por nombre coincidente, pero hay que redactarlo.
2. **Tabla 7 y F2, agenda (Aclarar).** El correo es un canal real (SMTP). El correo automático que envía la landing con el enlace de Telegram se registra como mensaje saliente por Correo, entregado cuando el servidor lo acepta, y **cumple el intento 0** de la agenda si el contacto autorizó el correo. Si no hay correo, el primer mensaje automático por Telegram o WhatsApp cumple ese intento. El `/start` y las respuestas del agente no cuentan. La agenda muestra el canal con que se cumplió cada intento.
   - Riesgo metodológico a declarar: ese primer correo es de bienvenida y verificación, no un mensaje comercial, y eleva L-1.1 (M2). El informe no lo prohíbe, pero conviene decirlo al interpretar L-1.
3. **D3 Canal (Ajustar).** Se añade el valor **Portal web** (id 4) para registrar la aceptación hecha en la oferta pública. No es un canal de contacto: ninguna autorización de F8 se concede por él. Los tres canales de contacto siguen siendo WhatsApp, correo y Telegram.
4. **F7, tipos de evento (Ajustar).** Se añade el evento 14, **Habilitación del servicio**, que registra la activación posterior a la validación (fechaHabilitacion).
5. **F9, `esAutomatico` (Aclarar, sin cambio de texto).** Se mantiene como en el informe: marca solo respuestas automáticas entrantes. Los mensajes salientes del agente y de la agenda llevan 0; su origen (agenda, respuesta del agente, personal comercial) ya los distingue. Esto se corrigió en esta revisión (ver sección 4).
6. **Revisión manual de seguimiento (Aclarar).** El botón de la consola reevalúa prioridades y cierra casos inactivos, pero ya no decide ni omite intentos: eso lo hace solo el worker con su canal de envío.
7. **Historial de prioridad en la consola (Aclarar).** La base guarda cada evaluación, aunque la prioridad no cambie (F6). La consola muestra solo los cambios de prioridad por claridad.

## 4. Base de datos: qué cambió en el script

Archivo único: `script/LaPreDigital_OLTP.sql` (repetible; crea la base si no existe).

- **Eliminados los ALTER.** Antes había cinco: reemplazo del CHECK de `Mensaje`, `ALTER COLUMN` de `App_OperationEvidence.idOperador` y columnas añadidas a `App_PublicInquiry`, `App_TelegramLink` y `App_Dispatch`. Ahora todo está dentro de su `CREATE TABLE`.
- **Catálogos integrados.** El evento 14 y el canal 4 están dentro de los INSERT originales.
- **Triggers.** Pasaron de `CREATE OR ALTER` a `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`.
- **Mensaje.** Vuelve a tener su CHECK original: los mensajes salientes exigen `esAutomatico = 0`. El código se ajustó en los cinco lugares donde insertaba salientes con 1 (seguimiento, respuestas del agente, onboarding, propuestas y la prueba que lo simulaba).
- **Eliminado.** El login `landing_app` con su contraseña literal y sus permisos (era de la landing antigua en Next.js, que conectaba directo a SQL Server; la landing actual pasa por el servidor).
- **App_OperationEvidence.** `idOperador` admite nulo, porque la aceptación pública y el pago de Stripe no los hace un operador.
- **Verificado.** Se ejecutó el script completo dos veces seguidas en una base temporal (ya eliminada): 76 tablas, 9 triggers, 4 canales, 14 tipos de evento, 0 índices explícitos y sin errores. Las 68 pruebas pasan contra esa base.
- **Tu base actual** sigue con el esquema anterior (conserva el CHECK relajado y el índice filtrado de solicitudes). Para igualarla hay que recrearla.

## 5. Hallazgos que conviene decidir o corregir antes de entregar

1. **Preguntas de pago y nivel Compra.** La Tabla 5 ubica "¿Qué medios de pago aceptan?" y "cómo adquirir" en Compra. En la prueba, Ollama devolvió Consulta para la primera. Hoy el agente ya las entiende y responde con el catálogo, pero la prioridad no sube a Alta por esa frase. Se puede forzar Compra por regla si lo quieres.
2. **Pago simulado (decisión: mantener solo para la demo).** `DEMO_PAYMENTS=1` habilita un botón en la consola y otro en la oferta pública que registran un pago sin pasar por Stripe (referencia `demo_pago_…`). Con la bandera apagada no existe. En la demo, marcar L-5.1 como dato simulado. Mientras esté activa con el túnel abierto, cualquiera con el enlace personal de una oferta aceptada puede registrar un pago falso.
3. **Tablas sin uso (decisión: mantener).** `BeneficiarioCursoDificil`, `BeneficiarioPostulacionAnterior` y `ObjecionComercial`. Documentarlas como no capturadas todavía.
4. **Estado de WhatsApp.** La sección 2.5 y D3 lo contemplan; el código tiene el canal en catálogos y autorizaciones, pero no hay integración.

## 6. Discrepancias detectadas al validar el sistema contra el informe (solo documentadas)

Revisión del 10 de noviembre de 2026 por lectura del código y del script. Se añadieron a la sección 9.2 del informe v28 y **no** se corrigieron.

1. El resultado «Sin respuesta» de una propuesta no se asigna a los siete días (el parámetro `PLAZO_RESPUESTA_PROPUESTA_DIAS` no se usa).
2. Una propuesta con respuesta registrada no admite una respuesta distinta (F5 pide conservar la última dentro del plazo).
3. `IntentoContacto.idMensajeRespuesta` nunca se completa (F2).
4. Los intentos de la agenda no se omiten con un pago pendiente de validación (F2, F7).
5. Un pago sobre un caso cerrado se rechaza en vez de reabrir el caso (F7).
6. No hay operación para corregir evaluaciones ni eventos (F6, F7, 3.4).
7. El nivel Compra no reconoce «comprar» y las preguntas de medios de pago dependen del modelo (Tabla 5).
8. Reconfirmar un canal con autorización vigente revoca y crea otra fila en vez de reutilizarla (F8).
9. No hay flujo de descuentos aprobados por operador; `idOperadorAprueba` se completa sin descuento (F5).
10. No hay recepción de correo ni de WhatsApp, ni marcado de respuestas automáticas entrantes (F9).
11. La evaluación inicial de 24 horas no tiene control propio y requiere el seguimiento activado (`FOLLOWUP_ENABLED`).
