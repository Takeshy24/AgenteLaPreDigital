# Contraste de la base de datos y el sistema con el informe v32

Revisión realizada el 12 de noviembre de 2026, hora de Lima.

La estructura de `LaPreDigital_OLTP` corresponde al modelo descrito en el informe v32 y al script del repositorio: se encontraron las mismas 77 tablas y 372 columnas, y los nueve triggers de negocio coinciden con el script. El cumplimiento funcional es parcial. Hay operaciones implementadas, reglas expresamente reconocidas como pendientes en el informe y diferencias adicionales en la aplicación de bloqueos, la trazabilidad y los indicadores.

La prioridad de trabajo es completar y verificar esas reglas, conservar las evidencias de cada transición y construir el DataMart y el ETL. Los resultados actuales del tablero se calculan sobre el OLTP y proceden de un único caso; permiten observar el recorrido de una negociación, pero no demostrar mejoras comerciales ni validar todos los escenarios.

## Alcance y fuentes

Se contrastaron tres fuentes:

1. [Informe v32 proporcionado](C:/Users/USERJSSV/Downloads/Informe_LEADS_LaPreDigital_David_Takeshy_Business_Intelligence_v32.docx): lectura estructural de 407 párrafos y 10 tablas, incluidas las reglas de 2.1–2.5, F1–F9, las medidas M1–M11 y las limitaciones de 9.2. Los identificadores Pxxxx utilizados en las evidencias son referencias de la extracción, no numeración original del Word.
2. [Script del OLTP](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/script/LaPreDigital_OLTP.sql) y código del sistema, revisión Git `07297c5d1e9fafdd1d377bf22e6b5bf15e76546f`.
3. Consultas de lectura a SQL Server Express 16.0.1000.6, instancia `DESKTOP-JDMKUO7\SQLEXPRESS`, base `LaPreDigital_OLTP`. El inventario se capturó a las 01:35; los controles y KPI, a las 01:50; la comprobación del entorno, a las 02:04, hora de Lima.

Las consultas no constituyen una instantánea transaccional única: describen el estado observado durante ese intervalo. No se ejecutaron migraciones, limpieza, escrituras de prueba ni envíos reales para este análisis. Se ejecutaron 21 pruebas seleccionadas de reglas y consultas de lectura. Esta revisión trata el contenido del informe y el comportamiento del sistema; no evalúa la maquetación del Word.

Se distingue entre **observado en datos**, **confirmado por código**, **reproducido en memoria** y **resultado histórico declarado por el informe**. Un defecto posible de un flujo no se presenta como una corrupción que ya haya ocurrido en los registros actuales.

## Estructura de la base de datos

| Elemento                        | Informe v32                       | Base activa y comprobación                                                           |
| ------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| Total de tablas                 | 77                                | 77; sin tablas faltantes ni adicionales respecto al script                           |
| Catálogos `Cat_*`               | 29                                | 29                                                                                   |
| Parámetros `Param_*`            | 2                                 | 2                                                                                    |
| Entidades de negocio            | 30                                | 30                                                                                   |
| Tablas de apoyo `App_*`         | 16                                | 16                                                                                   |
| Columnas                        | No presenta un total              | 372; sin diferencias detectadas de nombres y propiedades comparadas frente al script |
| Claves primarias                | Identificación por entidad        | 77                                                                                   |
| Claves foráneas                 | Relaciones de 5.2                 | 144; ninguna deshabilitada ni marcada como no confiable                              |
| Restricciones `CHECK`           | Reglas de integridad              | 47; ninguna deshabilitada ni marcada como no confiable                               |
| Unicidad adicional              | Restricciones y triggers          | 40 índices únicos adicionales a las PK                                               |
| Triggers de negocio             | 9                                 | Los 9 habilitados; definiciones coincidentes con el script                           |
| Triggers del monitor            | Herramienta auxiliar              | 0 en el momento del inventario                                                       |
| Vistas y procedimientos propios | Lógica aplicada desde el servidor | No se encontraron en esta base; las operaciones están en consultas del backend       |

La comparación de columnas comprobó nombres, tipos, longitudes, precisión, escala, nulabilidad e identidad de las columnas físicas. Reconoció también la columna calculada `Contratacion.servicioPrestado`; no la trató como una columna física de tipo distinto. No se realizó una prueba exhaustiva de equivalencia de todas las expresiones de valores predeterminados y restricciones.

Que el script no declare índices mediante `CREATE INDEX` no significa que la base carezca de índices: las claves primarias y las restricciones únicas crean estructuras físicas de soporte. Tampoco significa que las claves foráneas garanticen todas las relaciones comerciales entre filas. Por ejemplo, una FK comprueba que un beneficiario exista, pero no demuestra por sí sola que un contacto con rol Estudiante sea ese beneficiario.

### Organización del modelo

| Concepto                        | Tablas principales                                                         | Interpretación                                                         |
| ------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Persona que conversa            | `Contacto`, `PerfilContacto`                                               | Identidad y datos del contacto, incluido su presupuesto                |
| Estudiante                      | `Beneficiario`, `PerfilBeneficiario`                                       | Identidad académica, perfil y etapa IMPULSE                            |
| Relación comercial persistente  | `Lead`                                                                     | Combinación contacto–beneficiario                                      |
| Oportunidad comercial           | `Caso`                                                                     | Negociación del beneficiario, con apertura y cierre                    |
| Participación en la oportunidad | `LeadCaso`                                                                 | Rol, interés, prioridad, elegibilidad y estado de ese LEAD en ese caso |
| Conversación y seguimiento      | `Mensaje`, `IntentoContacto`, `Derivacion`                                 | Evidencias, agenda y atención humana                                   |
| Historial comercial             | `EvaluacionPrioridad`, `EventoCaso`                                        | Evaluaciones y acontecimientos que conservan trazabilidad              |
| Formalización                   | `PropuestaComercial`, `Contratacion`, `BecaCompleta`, `BloqueoPromocional` | Propuesta, aceptación, pago, validación, beca e incidencias            |

Esta separación coincide con la sección 2.1 del informe. Un contacto no equivale a un LEAD; una prioridad pertenece a una participación y una conversión pagada se contabiliza por caso. Esta distinción está presente tanto en la estructura como en los módulos del backend.

### Parámetros y catálogo

Los valores activos coinciden con la Tabla 7: evaluación inicial 24 horas, reevaluación 7 días, atención de derivaciones 24 horas, reapertura e inactividad 30 días, umbrales de Baja y Nula en 3 y 7 intentos, ventana analítica de 168 horas y prueba de 14 días. La agenda contiene exactamente los días 0, 1, 2, 5, 10, 17 y 27.

Hay tres planes pagados y cinco tarifas vigentes, coherentes con la Tabla 4:

| Plan          |  Mensual |     Semestral |
| ------------- | -------: | ------------: |
| Ruta UNT      | S/ 39.90 | No disponible |
| Meta UNT      | S/ 79.90 |     S/ 399.90 |
| Meta UNT Plus | S/ 99.90 |     S/ 499.90 |

Explora UNT está separado en `PruebaGratuita`; no aparece como una tarifa pagada. El catálogo incluye los cuatro niveles de interés del informe: Ninguno, Consulta, Compra e Intento de compra. Las características comerciales de la Tabla 4 se conservan en [offer.json](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/src/shared/offer.json), mientras que precios, modalidades y vigencias se leen del OLTP.

## Estado observado de la negociación actual

| Registro o resultado                                |                  Cantidad |
| --------------------------------------------------- | ------------------------: |
| Contactos                                           |                         1 |
| Beneficiarios                                       |                         1 |
| LEADs                                               |                         1 |
| Casos                                               |                         1 |
| Participaciones                                     |                         1 |
| Intentos programados                                |                         7 |
| Intentos vinculados a un envío entregado            |                         1 |
| Intentos con `idMensajeRespuesta` informado         |                         0 |
| Mensajes                                            |                        17 |
| Evaluaciones de prioridad                           |                        12 |
| Preguntas de perfil                                 |                         4 |
| Cambios de perfil                                   |                         2 |
| Propuestas                                          |               1, aceptada |
| Contrataciones                                      | 1, sin pago ni validación |
| Eventos del caso                                    |                         2 |
| Pruebas gratuitas, becas y vinculaciones económicas |                         0 |

La participación está **Activa**, con interés **Intento de compra** y prioridad **Alta**. El beneficiario sigue en **LEADS**. Estos estados son compatibles: existe aceptación de propuesta y de condiciones, pero no hay un evento de pago confirmado ni de validación contractual. La aceptación y la apertura del pago no constituyen una conversión pagada.

Los 17 mensajes se distribuyen en 8 entrantes y 9 salientes: WhatsApp tiene 2 entrantes y 3 salientes; Telegram, 5 entrantes y 5 salientes; Correo, 1 saliente; Portal web, 1 entrante. Los 8 despachos registrados corresponden a Telegram y WhatsApp; el correo de captación utiliza el envío SMTP directo. No hay una contradicción entre nueve mensajes salientes y ocho filas del despachador.

Se observaron 11 eventos de WhatsApp procesados sin error registrado, de los cuales 9 son estados de entrega, y 5 actualizaciones de Telegram procesadas sin error registrado. Esto es evidencia de actividad de las integraciones; no acredita por sí solo el cumplimiento de todos sus recorridos.

### Controles de integridad sobre los datos actuales

Se ejecutaron 17 consultas y todas devolvieron cero anomalías para los siguientes controles:

- Duplicados de correo normalizado, LEAD contacto–beneficiario, caso abierto por beneficiario, participación LEAD–caso, autorización vigente por canal e intento por número.
- Correspondencia de beneficiario entre LEAD y caso, identidad del rol Estudiante, contacto del mensaje y LEAD de la participación del mensaje.
- Concordancia de interés y prioridad con la última evaluación; siete intentos por participación elegible; ausencia de participaciones activas sin canal autorizado.
- Coherencia de fechas de entrega, presencia de respuesta o autorización en salientes, correspondencia contacto/canal de la autorización y su vigencia temporal al entregarse el mensaje.

El alcance es limitado: la base contiene un solo caso y no contiene vinculaciones, reembolsos, becas ni correcciones auditadas. Por eso estas consultas no permiten certificar los recorridos que necesitan esos datos.

## Contraste de los formatos y actividades

| Formato o actividad             | Implementación encontrada                                                | Evaluación                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| F1 Captación y participación    | Normalización, relación persistente, caso abierto, elegibilidad y agenda | Estructura alineada; falta reforzar la identidad del rol Estudiante y el evento inicial a LEADS              |
| F2 Contacto inicial y respuesta | Agenda única, envíos, confirmaciones y contador temporal                 | Parcial: falta vínculo explícito de respuesta, bloqueo por pago pendiente y seguimiento posterior por correo |
| F3 Perfil                       | Preguntas, cambios, dato previo/nuevo, procedencia y corrección humana   | Implementado; requiere precisar la atribución analítica cuando un contacto usa varios canales o roles        |
| F4 Responsable económico        | Necesidad, invitación, aceptación y dos autorizaciones                   | Parcial: recorrido de contactos existentes y verificación temporal de autorizaciones en M7                   |
| F5 Propuestas                   | Tarifa vigente, descuento humano, entrega y aceptación separadas         | Parcial: sin expiración automática del resultado ni cambio de respuesta                                      |
| F6 Prioridad                    | Orden de reglas, historial e interés persistente                         | Parcial: falta corrección referenciada y el indicador de seguimiento permitido es incompleto                 |
| F7 Contratación e incidencias   | Pago, validación, beca, reembolso, bloqueo y habilitación registrada     | Parcial: reapertura por pago, correcciones, bloqueo ambiguo y distinción de constancias manuales             |
| F8 Autorizaciones               | Estados, fechas, canal e historial                                       | Parcial: reconfirmación de autorizaciones vigentes y origen en vinculaciones                                 |
| F9 Mensajes e interacciones     | Bandejas, evidencias, respuestas y entrega por canal                     | Parcial: onboarding completo de WhatsApp y tratamiento de automáticos/rebotes                                |
| Indicadores                     | Seis KPI sobre lecturas del OLTP                                         | Implementados con diferencias analíticas descritas más adelante                                              |
| DataMart y ETL                  | Capítulo 6 pendiente y sin implementación encontrada en el repositorio   | No implementados en el proyecto revisado                                                                     |

## Diez diferencias que ya reconoce el informe

Las siguientes diferencias no se presentan como descubrimientos nuevos. Se contrastó la lista de la sección 9.2 con el código actual.

| ID  | Regla y situación                                          | Contraste y efecto                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | F5: resultado Sin respuesta después de siete días          | Confirmada. Existe el parámetro, pero el mantenimiento no actualiza el resultado vencido. El KPI puede clasificar analíticamente la falta de respuesta, mientras `PropuestaComercial.idResultado` sigue vacío. [Seguimiento](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/followup/service.mjs:10).                                                                                                                                                                                   |
| D02 | F5: conservar la última respuesta expresa dentro del plazo | Confirmada. Una respuesta distinta se rechaza cuando la propuesta ya tiene resultado. Esto también debe resolverse al implementar D01, para admitir una aceptación tardía de una propuesta marcada Sin respuesta. [Respuesta de propuesta](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/proposals/service.mjs:62).                                                                                                                                                                    |
| D03 | F2: `idMensajeRespuesta` no se completa                    | Confirmada por código y datos. Hay un intento entregado y mensajes entrantes posteriores, pero cero intentos con ese vínculo explícito. El contador y los KPI se apoyan en fechas. [Mensajes](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/messages/repository.mjs:64).                                                                                                                                                                                                               |
| D04 | F2: omitir agenda con pago pendiente de validación         | Confirmada. La consulta y el servicio consideran beca pendiente, bloqueo y derivación, pero no pago pendiente; tampoco se observa ese control en el despachador. [Preparación de intentos](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/followup/repository.mjs:21), [decisión](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/followup/service.mjs:33).                                                                                                                       |
| D05 | F7: pago sobre un caso cerrado sin contratación            | Confirmada. `recordPayment` rechaza un caso cerrado, aunque el informe contempla una reapertura restringida para registrar ese pago y conservar el cierre anterior. [Pago](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/contracts/service.mjs:54).                                                                                                                                                                                                                                    |
| D06 | F6/F7: correcciones auditadas                              | Confirmada. Existen las columnas de referencia, pero no se encontró una operación de corrección. Además, al implementarla habrá que revisar todos los KPI: las lecturas de contratos no excluyen expresamente pagos o validaciones anulados por otro evento. [Evaluaciones](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/priorities/service.mjs:41), [lectura de contratos](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/kpis/repository.mjs:198).                           |
| D07 | F8: reutilizar una autorización ya vigente                 | Confirmada para los recorridos que llaman a `saveConsent`, que revoca y vuelve a insertar. La captación mediante `grantConsent` sí reutiliza la vigente. No es un fallo uniforme de todos los puntos de entrada. [Reconfirmación](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/consents/service.mjs:22), [captación](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/leads/repository.mjs:236).                                                                                 |
| D08 | F8: origen Vinculación para el responsable                 | Confirmada. La aceptación invoca la captación común, que guarda origen Formulario. El vínculo existe, pero su procedencia queda mal clasificada. [Aceptación](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/links/service.mjs:25), [autorización](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/leads/repository.mjs:236).                                                                                                                                                     |
| D09 | F9: automáticos y rebotes                                  | Confirmada como limitación. El modelo permite marcar automáticos, pero no hay recepción de correo ni clasificación equivalente en las inserciones ordinarias de mensajes entrantes. En la muestra todos los entrantes están marcados como no automáticos; eso no demuestra que se haya recibido un rebote real. [Inserción entrante](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/messages/repository.mjs:45).                                                                        |
| D10 | Tabla 7: control de evaluación inicial                     | Requiere matizar la redacción. El seguimiento evalúa participaciones Pendientes cuando está activado y existe un listado de pendientes vencidos. Ese listado fija 24 horas en el SQL y no usa `EVALUACION_INICIAL_HORAS`. No existe un mecanismo independiente del worker que garantice el plazo. [Evaluables](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/followup/repository.mjs:298), [pendientes](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/pending/service.mjs:78). |

## Diferencias adicionales y controles que conviene corregir

### A01 Identidad del rol Estudiante

**Prioridad alta. Regla:** F1 exige que el rol Estudiante corresponda al contacto identificado como beneficiario, y viceversa.

El API de captación permite proporcionar `beneficiaryId`. Cuando se proporciona, `saveLead` comprueba que el beneficiario exista, pero la consulta devuelve únicamente una señal de existencia: no verifica que `idContactoBeneficiario` coincida con el contacto cuando el rol es Estudiante, ni la condición inversa. Esto deja un recorrido de entrada capaz de registrar una relación comercial incoherente, aunque las FK sean válidas.

No se encontró esa anomalía en el caso actual. Debe verificarse expresamente la relación contacto–beneficiario–rol antes de insertar la participación. Fuentes: [ruta de captación](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/leads/routes.mjs:5), [selección del beneficiario](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/leads/service.mjs:31), [comprobación de existencia](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/leads/repository.mjs:101).

### A02 Un mensaje sin beneficiario identificado levanta bloqueos

**Prioridad alta. Regla:** F7 establece que un mensaje ambiguo no termina el bloqueo promocional hasta identificar al beneficiario.

`recordUnassigned` llama inmediatamente a `clearContactBlocks`. Esa consulta termina todos los bloqueos abiertos de los beneficiarios asociados al contacto, antes de que el mensaje se asigne a uno de ellos. Un contacto relacionado con dos estudiantes podría, por ejemplo, levantar el bloqueo de ambos con un saludo sin indicar de cuál habla.

El reinicio del contador para las participaciones abiertas puede hacerse según 2.2; terminar el bloqueo requiere resolver la identidad del beneficiario. Son efectos distintos. La corrección debe diferir ese segundo efecto hasta la asignación. Fuentes: [mensaje no asignado](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/messages/service.mjs:8), [actualización de bloqueos](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/messages/repository.mjs:19). No existen bloqueos en la muestra actual para observar un caso ya afectado.

### A03 La vinculación M7 puede contar autorizaciones que no coincidieron vigentes

**Prioridad alta para la medición. Regla:** 3.4 y F4 exigen vínculo y dos autorizaciones simultáneamente vigentes dentro de siete días.

`listInvitations` toma el mínimo `fechaOtorgamiento` de las autorizaciones con estado Vigente o Revocada. No devuelve ni compara sus fechas de revocación. Después `linkingRows` toma la mayor de las tres fechas como logro. Usar una autorización histórica revocada es válido para reconstruir el pasado solo si se verifica que seguía vigente en el instante del logro; esa comprobación falta.

Se reprodujo en memoria el siguiente caso: autorización de contacto otorgada el 1 de octubre y revocada el 2; necesidad el 1 de noviembre; vínculo y autorización de vinculación el 2 de noviembre; nueva autorización de contacto el 10 de noviembre. La ventana termina el 8 de noviembre. El cálculo actual produce M7 verdadero, aunque nunca coincidieron las tres condiciones dentro del plazo. Deben reconstruirse los intervalos de vigencia y obtener su primera intersección válida. Fuentes: [lectura de autorizaciones](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/kpis/repository.mjs:99), [cálculo de logro](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/kpis/cohorts.mjs:114).

### A04 Resultados alcanzados con ventana abierta no se marcan provisionales

**Prioridad media. Regla:** 3.2 y 7.1 establecen la consolidación al concluir las ventanas y la señalización de ventanas aún abiertas.

`computeKpi` deja de examinar una unidad cuando ya alcanzó el numerador. Por tanto, `provisional` cuenta únicamente unidades todavía no logradas con ventana abierta. Se reprodujo una entrega lograda cuatro horas después del inicio: el resultado es 100 %, la ventana sigue abierta y `provisional` devuelve cero.

En los datos actuales sucede lo mismo con L-1.1, L-1.2, L-2.1 y L-4.1: muestran 100 % y cero provisionales pese a que los eventos son del 11 de noviembre y aún no transcurrieron siete días. Debe distinguirse entre «resultado ya alcanzado» y «ventana cerrada», o explicar expresamente otro criterio de provisionalidad en el informe. Fuente: [agregación](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/kpis/rules.mjs:237).

### A05 El correo inicial funciona pero no existe seguimiento posterior por correo

**Prioridad alta si se aceptan registros con solo Correo. Regla:** Tabla 7 y F2 seleccionan el primer canal autorizado que pueda utilizarse.

El registro puede enviar la confirmación inicial por SMTP y cumplir el primer intento. Sin embargo, el worker solo considera utilizables los canales Telegram y WhatsApp; el despachador también enumera únicamente esos dos. Un contacto que solo autoriza Correo puede quedar con sus siguientes intentos omitidos aunque SMTP esté configurado.

La existencia de `AutorizacionContacto` para Correo y de una agenda de siete intentos no equivale a disponer de un seguimiento automático completo por ese canal. La limitación debe aparecer en el alcance del informe, o implementarse el envío posterior con sus controles y recepción de respuestas. Fuentes: [selección del canal](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/workers.mjs:90), [omisión sin canal](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/followup/service.mjs:66), [despacho](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/integrations/dispatch.mjs:91).

### A06 El recorrido de un responsable existente difiere de F4

**Prioridad media. Regla:** F4 contempla reutilizar un responsable ya registrado y autorizado, enviarle directamente la invitación y solicitar solo la vinculación que falte.

El flujo de invitación genera un enlace para reenviarlo. La aceptación pública rechaza un correo existente y requiere confirmación del personal comercial; la aceptación interna sí puede reutilizar contactos. Tampoco se encontró en el flujo de invitación el envío directo al responsable ya autorizado.

La revisión humana puede ser una decisión de seguridad razonable, como sucede en la captación pública. Debe describirse como excepción en F4 y en el recorrido operativo, o completarse un mecanismo de verificación de identidad que permita el comportamiento planteado. Fuentes: [invitación](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/links/service.mjs:7), [aceptación pública](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/public/invitations.mjs:16).

### A07 F9 promete captación por chat más amplia que la implementada en WhatsApp

**Prioridad media.** F9 describe la creación provisional y la recogida de los datos mínimos para un remitente no registrado. Telegram implementa ese onboarding. WhatsApp, en cambio, envía el enlace de la landing y no crea en ese recorrido el contacto, la solicitud provisional ni un mensaje F9 asociado a ese contacto; sí conserva el evento bruto en `App_WhatsAppInbox`.

La sección 7.3 del propio informe describe correctamente ese comportamiento de WhatsApp, mientras F9 formula una regla general más amplia. Se debe acotar F9 por canal o implementar ese onboarding en WhatsApp. Fuentes: [remitente de WhatsApp](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/integrations/whatsapp.mjs:111), [onboarding de Telegram](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/onboarding/service.mjs:74).

### A08 Seguimiento permitido no representa todas las prohibiciones de F6

**Prioridad media de trazabilidad.** F6 indica que `seguimientoPermitido` debe ser falso durante un bloqueo promocional o una derivación, además de las suspensiones.

La evaluación guarda ese valor usando solo la condición de participación Activa y prioridad distinta de Nula. Puede quedar verdadero mientras existe una derivación o un bloqueo. El despachador hace otras comprobaciones y puede impedir el envío; el problema señalado es que la fotografía auditada de la evaluación no cumple el significado declarado para ese campo. Fuente: [valor registrado](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/priorities/service.mjs:37).

### A09 Falta el evento explícito de ingreso a LEADS

**Prioridad media de trazabilidad.** F7 incluye el acontecimiento Ingreso a LEADS y explica la copia de etapa vigente a partir de eventos.

La captación crea al beneficiario con la etapa inicial de la tabla y registra Apertura de caso, pero no se encontró una inserción del evento tipo 1, Ingreso a LEADS, en ese recorrido. En la base actual los únicos eventos son Apertura de caso y Aceptación de condiciones. La etapa inicial es coherente, pero el acontecimiento requerido no está documentado en el historial F7. Fuentes: [creación y apertura](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/leads/service.mjs:79), [evento de apertura](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/leads/repository.mjs:215).

### A10 Hay dos detalles que afectan al nivel Intento de compra

**Prioridad media.** La Tabla 5 define ese nivel por la apertura del pago en la pasarela y 2.5 establece que se conserva el mayor nivel, salvo las excepciones previstas.

Primero, `payOffer` registra el nivel 4 antes de pedir la creación de la sesión de Stripe. Si esa petición falla, la evaluación ya quedó guardada, aunque no se haya podido iniciar Checkout. Conviene registrar el cambio después de obtener una sesión válida y denominar con precisión qué suceso acredita.

Segundo, la activación de Explora fija el nivel en 3 sin conservar expresamente un nivel 4 anterior. En un caso que ya abrió el pago y después activa la prueba, puede producirse una bajada que no corresponde a retractación, corrección o reactivación desde Nula. Ambos recorridos requieren pruebas de transición, no solo comprobar que el resultado siga siendo prioridad Alta. Fuentes: [apertura del pago](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/public/service.mjs:112), [activación de prueba](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/trials/service.mjs:36).

### A11 Las constancias manuales deben distinguirse de confirmaciones de plataforma

**Prioridad alta antes de operar pagos o mediciones reales.** El informe describe pago confirmado por pasarela y entrega de WhatsApp confirmada por Meta.

Además de Stripe y del modo demo, existe una ruta interna de confirmación de pago que recibe importe, referencia y `confirmedExternally: true`; no consulta a la pasarela. También existe una constancia manual de entrega que excluye Telegram, pero admite WhatsApp y Correo. Estas operaciones registran una afirmación del operador, no una confirmación técnica recibida de Stripe o Meta.

Pueden mantenerse como funciones de constancia humana de un prototipo, pero el informe debe documentarlas. Para exigir exclusivamente confirmaciones de plataforma, hay que restringir esos recorridos y preservar la procedencia en las consultas y los indicadores. No se encontraron pagos manuales o simulados ya registrados en la contratación actual. Fuentes: [ruta de pago](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/contracts/routes.mjs:30), [registro del pago](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/contracts/service.mjs:54), [constancia de entrega](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/messages/delivery.mjs:8).

### A12 La atribución de L-2 por canal y rol necesita una definición explícita

**Decisión metodológica pendiente.** La Tabla 10 permite desglosar M4 y M5 por canal y rol, y 4.2 exige respetar los conteos únicos cuando intervienen varios canales.

`profileRows` produce una sola fila por contacto y mes, tomando canal y rol de la primera pregunta. En una reproducción con preguntas por Correo y Telegram, el contacto aparece solo en Correo y el filtro Telegram devuelve denominador cero. El total global por contacto-mes no se duplica; la decisión pendiente está en los segmentos.

Debe acordarse si se atribuye todo a la primera pregunta, documentándolo en el informe, o si el contacto aparece en cada segmento donde fue consultado y se deduplica al consolidar. No se debe cambiar la fórmula sin resolver ese criterio. Fuente: [cohorte de perfil](C:/Users/USERJSSV/Downloads/AgenteLaPreDigital/server/kpis/cohorts.mjs:71).

## Indicadores observados y límites de interpretación

| Indicador                   | Resultado leído        | Interpretación de esta muestra                                        |
| --------------------------- | ---------------------- | --------------------------------------------------------------------- |
| L-1.1 Cobertura inicial     | 1/1 = 100 %            | El único participante elegible tiene un envío inicial entregado       |
| L-1.2 Respuesta inicial     | 1/1 = 100 %            | Existe una respuesta posterior dentro de la ventana                   |
| L-2.1 Ampliación del perfil | 1/1 = 100 %            | El único contacto consultado registró información nueva o actualizada |
| L-3.1 Vinculación económica | 0/0 = No aplicable     | No hay necesidades de vinculación registradas                         |
| L-4.1 Aceptación            | 1/1 = 100 %            | La única propuesta entregada figura aceptada                          |
| L-5.1 Conversión pagada     | 0/1 = 0 %, provisional | El caso alcanzó Alta, pero aún no tiene pago y validación             |

El estado Crítico que devuelve L-5.1 es el semáforo académico aplicado al valor actual; su ventana está abierta. No debe interpretarse todavía como un resultado definitivo de fracaso comercial. Las cuatro tasas de 100 % tampoco prueban efectividad estadística con una sola unidad.

Las pruebas seleccionadas comprobaron umbrales, ventanas de 168 horas, conteos únicos, filtros, catálogo, clasificación y consultas de KPI/PDF: **21 ejecutadas, 21 aprobadas**. Ese resultado no equivale a ejecutar toda la matriz F1–F9 ni a certificar los defectos que no están cubiertos por esas pruebas.

Se conservaron reproducciones adicionales en memoria para A03, A04 y A12. Son ejemplos controlados de comportamiento del código, no datos reales insertados en la base.

## Configuración e integración encontradas

| Aspecto                                | Estado leído de la configuración o del entorno | Alcance                                                                                                                       |
| -------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Seguimiento                            | Activado; intervalo 60 segundos                | Habilita la revisión periódica cuando el servidor carga esta configuración                                                    |
| Telegram y WhatsApp                    | Activados                                      | Los registros actuales contienen actividad procesada de ambos                                                                 |
| SMTP                                   | Usuario y clave configurados                   | Existe un mensaje de correo entregado registrado; no se enviaron pruebas reales en esta auditoría                             |
| Stripe                                 | Clave con prefijo de prueba configurada        | No se validó una transacción nueva contra Stripe                                                                              |
| Webhook de Stripe                      | Sin secreto configurado                        | El receptor firmado no puede validar eventos con esta configuración; sigue existiendo la conciliación al volver del navegador |
| Pago demo                              | `DEMO_PAYMENTS=1`                              | Puede registrarse un pago simulado; no constituye ingreso real                                                                |
| WhatsApp fuera de 24 horas             | Plantilla `hello_world`                        | Limitación ya declarada en 9.2; falta una plantilla comercial propia                                                          |
| IA                                     | Ollama habilitado, `llama3.2:3b`               | Se revisaron validaciones y reglas; no se repitió aquí la evaluación completa del modelo                                      |
| Conexión SQL de la auditoría           | Windows integrada, con `sysadmin`              | La configuración debe separarse de una cuenta con permisos mínimos antes de un uso de producción                              |
| Bases del proyecto visibles por nombre | `LaPreDigital_OLTP` y `LaPreDigital_OLTP_test` | No se encontró una base DataMart con ese prefijo; tampoco su implementación en el repositorio revisado                        |

Los valores de variables proceden del `.env` leído por la auditoría; no constituyen una inspección de las variables ya cargadas en memoria por un servidor antiguo. Las claves y sus valores no se incluyen en este documento. El resultado de permisos corresponde a la conexión abierta con esa configuración.

La limitación de autenticación de la consola está reconocida por el informe y se confirma en las rutas: opera con un operador local, sin autenticación por persona. La existencia de una fila `Operador` no equivale a tener usuarios autenticados y autorizados por rol.

La habilitación y el vencimiento de pruebas están representados como registros del OLTP. El repositorio revisado no integra un servicio educativo que conceda o retire acceso real a contenidos. Debe distinguirse «registrar la habilitación» de ejecutar el aprovisionamiento en una plataforma educativa.

## DataMart y documentación pendiente

El capítulo 6 conserva instrucciones pendientes de completar para modelo dimensional, diccionario, ETL y conciliación. El sistema calcula los KPI desde consultas de `server/kpis`, por lo que todavía no implementa el circuito OLTP → ETL → DataMart descrito como objetivo.

El diseño siguiente es una orientación de construcción, no una descripción de tablas existentes:

| Análisis               | Grano que debe conservarse para el conteo                               | Origen temporal                    |
| ---------------------- | ----------------------------------------------------------------------- | ---------------------------------- |
| Contacto inicial M1–M3 | Participación LEAD–caso; detalle de intentos y respuestas como sustento | Inicio original de elegibilidad    |
| Perfil M4–M5           | Contacto por mes; preguntas y cambios como detalle                      | Pregunta elegible del periodo      |
| Vinculación M6–M7      | Caso por mes con primera necesidad nueva; historial de autorizaciones   | Primera necesidad nueva            |
| Propuestas M8–M9       | Propuesta entregada como detalle; caso-mes único en el agregado         | Entrega de cada propuesta          |
| Conversión M10–M11     | Caso único con primera Alta válida                                      | Primera evaluación Alta no anulada |

Las dimensiones Tiempo, Contacto, Canal, Rol, Plan y Prioridad deben conservar el contexto del evento. El ETL necesita recargas idempotentes, detección de cambios y conciliación con M1–M11; no basta con copiar los totales que muestra la pantalla. Deben probarse límites de 168 horas, meses distintos, reapertura, revocaciones y correcciones auditadas.

Hay ajustes documentales concretos:

- **5.3:** falta insertar el diagrama entidad–relación.
- **5.4:** es correcto que no hay `ALTER` ni `CREATE INDEX`, pero la descripción «solo CREATE e INSERT» es incompleta: el script contiene nueve `DROP TRIGGER IF EXISTS` y sus recreaciones. Crear tablas solo si faltan no actualiza automáticamente columnas de una instalación anterior.
- **5.1:** precisar que hay identificadores de distintos tipos, como `INT` para Operador y PlanTarifa, claves de texto en algunas tablas auxiliares y vigencias `DATE`. Las marcas de tiempo comerciales se guardan en `DATETIME2(0)`.
- **7.1:** `npm run up` compila la interfaz y arranca componentes, pero no ejecuta la migración ni inicia el servicio SQL Server. La base debe estar creada y disponible. Además, su comprobación de disponibilidad HTTP no exige un código de salud exitoso.
- **7.5:** las capturas siguen pendientes de inserción.
- **8.2:** las 104 pruebas corresponden a una ejecución histórica declarada del 11 de noviembre. El código actual contiene 110 declaraciones de prueba de nivel superior en 20 archivos; este conteo estático no demuestra que todas pasen. No sustituir el dato histórico por una cifra nueva sin una ejecución completa y conservada.
- **7.2 y 8.2:** se verificó que existen 99 casos de evaluación del agente y 36 del conjunto reservado. No se reprodujeron aquí sus resultados ni su tiempo mediano. La propia versión 32 reconoce que el conjunto reservado se utilizó posteriormente para ajustar reglas; ese resultado no debe presentarse como una prueba nueva e independiente de generalización.
- **8.4 y 9.1:** discusión y conclusiones siguen como contenido pendiente.
- **Trazabilidad de conocimiento:** la etiqueta de fuente del agente todavía menciona Informe v30. Los precios encontrados coinciden con v32; actualizar la etiqueta requiere revisar la versión de la fuente, no asumir que el texto es distinto solo por su nombre.

## Orden recomendado de trabajo

1. **Reglas de contacto y consistencia:** resolver A01–A03 y D04; verificar también los bloqueos en el momento del despacho, no únicamente cuando se prepara el mensaje.
2. **Trazabilidad comercial:** completar D01–D03, D05–D08 y A08–A11; diseñar las correcciones auditadas junto con su efecto en los KPI.
3. **Canales y medición:** decidir el alcance de seguimiento por Correo, el onboarding de WhatsApp y la vinculación de contactos existentes; corregir provisionalidad y acordar la atribución de L-2.
4. **Evidencia de operación:** separar datos simulados y confirmaciones técnicas, configurar los componentes de la prueba de pagos que correspondan y ejecutar escenarios de borde en una base de prueba autorizada.
5. **Objetivo de BI:** implementar DataMart y ETL, conciliar sus medidas con el OLTP y completar las secciones pendientes del informe.

### Escenarios que faltan en una validación completa

| Escenario                                                                          | Resultado que debe verificarse                                           |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Rol Estudiante con el ID de un beneficiario de otro contacto                       | Rechazo de la vinculación incoherente                                    |
| Contacto con dos beneficiarios bloqueados y mensaje ambiguo                        | Los bloqueos permanecen hasta identificar al beneficiario                |
| Pago confirmado pendiente de validación y un intento vencido                       | Sin envío de agenda; resultado registrado como omitido según F2          |
| Propuesta entregada sin respuesta a los siete días                                 | Resultado Sin respuesta; aceptación tardía permitida sin sumar M9        |
| Aceptación seguida de rechazo dentro del plazo, con el caso abierto                | Última respuesta expresa conservada con trazabilidad                     |
| Primera Alta errónea corregida por el operador                                     | Conservación del registro y exclusión de la evaluación corregida en M10  |
| Autorización de contacto revocada antes del vínculo y renovada fuera de la ventana | M7 falso                                                                 |
| Resultado logrado con ventana todavía abierta                                      | Separación entre logro y consolidación temporal                          |
| Contacto consultado por dos canales y dos roles en un mes                          | Total global único y segmentos según el criterio acordado                |
| Fallo al crear Checkout                                                            | No registrar un inicio de pago que no se pudo iniciar                    |
| Activación de Explora después de Intento de compra                                 | Conservación del mayor nivel, salvo excepción documentada                |
| Correo como único canal autorizado                                                 | Comportamiento posterior al correo inicial conforme al alcance declarado |

## Evidencias de la revisión

Los siguientes archivos permiten revisar las consultas, los resultados agregados y las reproducciones. No contienen textos de conversaciones ni direcciones personales extraídas de la base.

- [Inventario de SQL Server y consultas](C:/Users/USERJSSV/.codex/visualizations/2026/11/12/01a1cd57-f333-7442-81bc-ecff54ed5c68/auditoria-v32/database-inventory.json).
- [Comparación del script y la estructura activa](C:/Users/USERJSSV/.codex/visualizations/2026/11/12/01a1cd57-f333-7442-81bc-ecff54ed5c68/auditoria-v32/schema-comparison.json).
- [Controles de integridad, estados y KPI](C:/Users/USERJSSV/.codex/visualizations/2026/11/12/01a1cd57-f333-7442-81bc-ecff54ed5c68/auditoria-v32/domain-audit.json).
- [Comprobación del entorno SQL](C:/Users/USERJSSV/.codex/visualizations/2026/11/12/01a1cd57-f333-7442-81bc-ecff54ed5c68/auditoria-v32/environment-audit.json).
- [Reproducciones de casos analíticos en memoria](C:/Users/USERJSSV/.codex/visualizations/2026/11/12/01a1cd57-f333-7442-81bc-ecff54ed5c68/auditoria-v32/rule-probes.json).

Comando de verificación ejecutado:

```powershell
node --test --test-concurrency=1 server/policy.test.mjs server/tests/intents.test.mjs server/tests/knowledge.test.mjs server/tests/kpis.test.mjs server/tests/workers.test.mjs
```

Resultado: 21 pruebas aprobadas, ninguna fallida. La prueba de KPI consulta la base y comprueba la respuesta del reporte PDF; las demás seleccionadas operan sobre reglas y datos controlados en memoria. La evidencia de esta revisión no certifica una ejecución completa de la matriz funcional ni pagos, mensajería o acceso educativo reales.
