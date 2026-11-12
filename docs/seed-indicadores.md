# Seed de indicadores y DataMart

Se encontró el seed original en `tools/seed-scenarios.mjs` (`npm run seed:scenarios`). Sus trece escenarios prueban vencimientos y seguimiento; incluyen conversión pagada y perfil, pero no vinculación económica ni las exclusiones y límites de conversión. Se conserva ese archivo para sus pruebas operativas.

El complemento está en `tools/seed-indicators.mjs`. Inserta evidencia simulada en el OLTP y ejecuta los ETL existentes para poblar el DataMart. No envía mensajes, no llama a las pasarelas y no altera contactos previos. Los ocho casos quedan cerrados y sus intentos sin enviar quedan omitidos. Los contactos usan nombres `Indicador I…` y correos `indicador.i…@example.test`; no deben presentarse como operación real.

```powershell
npm run datamart:init
npm run seed:indicators -- --check
npm run seed:indicators -- --yes
```

`--check` revierte los escenarios y su recarga. La preparación inicial del esquema y la carga de los datos que ya existían se conservan. `--yes` mantiene los escenarios. Repetir el seed completo recarga el DataMart sin duplicar sus diez contactos. Si se detecta un seed incompleto, se detiene para revisar sus registros; no elimina datos para repararlo.

| Caso | Evidencia y resultado esperado                                                                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I01  | Contacto respondido; dos preguntas con un dato nuevo: un contacto-mes en M4 y M5. Dos propuestas de planes diferentes: un caso-mes en M8 y M9, con aceptación solo del segundo plan. Pago y validación oportunos: M10 = 1 y M11 = 1. |
| I02  | Contacto inicial entregado, sin respuesta en su ventana: M2 = 1 y M3 = 0. Pregunta posterior sin dato nuevo: M4 = 1 y M5 = 0. Propuesta sin aceptación y sin pago.                                                                   |
| I03  | Estudiante y padre en un mismo caso. Vínculo y ambas autorizaciones coinciden dentro del plazo: M6 = 1 y M7 = 1.                                                                                                                     |
| I04  | Estudiante y madre. La autorización de contacto inicial se revoca antes del vínculo. La siguiente llega tarde: M7 = 0. Una necesidad repetida mientras la anterior está pendiente no abre otra cohorte.                              |
| I05  | Primera Alta y cierre por beca completa dentro del plazo: M10 = 0 y M11 = 0.                                                                                                                                                         |
| I06  | Pago y validación oportunos, seguidos de reembolso invalidante dentro del plazo: M10 = 1 y M11 = 0.                                                                                                                                  |
| I07  | Pago oportuno y validación exactamente un segundo después de las 168 horas desde la primera Alta: M10 = 1 y M11 = 0.                                                                                                                 |
| I08  | Apoderado con seguimiento autorizado, sin entrega: M1 = 1 y M2 = 0.                                                                                                                                                                  |

Las fechas se calculan desde el día 28 de dos meses antes, en hora de Lima, para cerrar las ventanas y conservar cambios de mes. Se eligen tarifas mensuales vigentes para esas fechas. Si faltan, el seed se detiene en vez de inventar precios o identificadores. Los dos responsables económicos agregan participaciones elegibles propias; los totales de contacto inicial deben incluirlas.

Los filtros del informe siguen aplicándose por dimensión: contacto y rol no filtran propuestas, y canal y plan no filtran conversión. Los totales incluyen también cualquier registro operativo que ya estuviera cargado para el período seleccionado.

La API lee exclusivamente los hechos del DataMart. Los cambios del OLTP se incorporan con **Actualizar datos** o `npm run datamart:refresh`. Las dimensiones usan los MERGE de inserción solicitados; las modificaciones a atributos de dimensiones ya cargadas no se sobrescriben. La prueba `server/tests/datamart.test.mjs` verifica el recorrido completo con rollback en las bases `_test`.
