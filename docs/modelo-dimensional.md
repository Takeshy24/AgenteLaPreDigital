# Modelo dimensional con keys

El DataMart mantiene las seis dimensiones y los cinco procesos de las secciones 3 y 4 del informe. Cada dimensión tiene una clave sustituta `Key... INT IDENTITY(1, 1)` como clave primaria. Los identificadores del OLTP se conservan como claves de negocio `UNIQUE` en sus dimensiones y sirven para resolver la key durante el ETL. Las relaciones entre tablas se definen exclusivamente sobre las keys del DataMart.

| Dimensión      | PK sustituta   | Identidad de negocio para el MERGE |
| -------------- | -------------- | ---------------------------------- |
| DimTiempo      | KeyTiempo      | fechaHora                          |
| DimContacto    | KeyContacto    | idContacto                         |
| DimCanal       | KeyCanal       | idCanal                            |
| DimRolContacto | KeyRolContacto | idRolContacto                      |
| DimPlan        | KeyPlan        | idPlan                             |
| DimPrioridad   | KeyPrioridad   | idPrioridad                        |

`DimTiempo` conserva los instantes observados como `DATETIME2(0)` y sus atributos fecha, año, trimestre, mes y día. Su jerarquía de análisis sigue siendo Año → Trimestre → Mes → Día. Varios instantes pueden pertenecer al mismo día. Esta precisión conserva las ventanas de 168 horas, incluido el último segundo permitido, sin guardar fechas como atributos en los hechos.

Las fechas de origen y resultado usan la misma dimensión con distintos roles: por ejemplo, `KeyTiempo`, `KeyTiempoPrimeraEntrega` y `KeyTiempoPrimeraRespuesta` referencian `DimTiempo.KeyTiempo`. Una key de resultado puede ser NULL cuando el evento todavía no existe.

## Tablas de hechos

Las tablas físicas de hechos contienen únicamente keys y las medidas M1 a M11, con restricciones CHECK: cada medida vale 0 o 1, M3 ≤ M2 y M11 ≤ M10, y una medida de logro en 1 exige la key de tiempo de ese logro. No contienen nombres, fechas, estados, precios, IDs de catálogo ni otros atributos descriptivos. Hay 28 claves foráneas hacia las dimensiones.

| Hecho                     | Grano conservado                                     | Medidas    |
| ------------------------- | ---------------------------------------------------- | ---------- |
| HechoContactoInicial      | Una participación LEAD–caso                          | M1, M2, M3 |
| HechoAmpliacionPerfil     | Una pregunta entregada; se cuenta contacto-mes único | M4, M5     |
| HechoVinculacionEconomica | Primera necesidad nueva de cada caso y mes           | M6, M7     |
| HechoPropuestaComercial   | Una propuesta entregada; se cuenta caso-mes único    | M8, M9     |
| HechoConversionPagada     | Un caso y su primera Alta válida                     | M10, M11   |

Las keys `KeyParticipacion`, `KeyPregunta`, `KeyPropuesta` y `KeyCaso` son claves degeneradas: conservan la identidad de la unidad transaccional en el hecho sin agregar dimensiones descriptivas que el informe no define. No son claves foráneas ni establecen relaciones entre hechos. Permiten respetar la distinción de la sección 4.2 entre dimensiones y unidades de conteo. En particular, eliminar `KeyCaso` de propuestas impediría contar una sola vez un caso que recibió dos planes.

Todas las demás keys de los hechos son FKs a las claves sustitutas de las dimensiones. Una key de catálogo nunca se obtiene copiando el ID del OLTP: el ETL busca ese ID en la dimensión y selecciona su `Key...`.

Ejemplo: `PropuestaComercial.idPlanTarifa → PlanTarifa.idPlan → DimPlan.idPlan`, y se inserta `DimPlan.KeyPlan` en `HechoPropuestaComercial.KeyPlan`. La consulta analítica relaciona exclusivamente `HechoPropuestaComercial.KeyPlan = DimPlan.KeyPlan`.

M4/M5 y M8/M9 no se suman entre preguntas, canales o planes para obtener el total general. El panel conserva el conteo único contacto-mes o caso-mes y los desgloses de la tabla 10. Las becas con M10 = 0 quedan fuera del denominador de conversión.

## Scripts y reconstrucción

- `sql/dimensiones.sql`: creación de la base y las seis dimensiones con keys IDENTITY.
- `sql/hechos.sql`: creación de los cinco hechos, sus PK y sus FK.
- `sql/etl_dimensiones.sql`: MERGE por identidad de negocio; SQL Server genera las keys nuevas y los nombres que cambian en el OLTP se actualizan (tipo 1).
- `sql/etl_hechos.sql`: vistas de preparación y recarga DELETE/INSERT de cada hecho dentro de su propia transacción, resolviendo las keys con JOIN.
- `sql/reiniciar_datamart.sql`: elimina las vistas de preparación y las once tablas dimensionales para reconstruir el modelo; no modifica tablas del OLTP.
- `sql/consultas_kpi.sql`: los seis indicadores por mes, cada uno con su unidad de conteo (M4/M5 por contacto-mes y M8/M9 por caso-mes con COUNT DISTINCT). Sirve para conciliar el DataMart con el panel.

Para actualizar una instalación con el modelo anterior:

```powershell
npm run datamart:rebuild
```

El comando reconstruye las once tablas y recarga el ETL en una sola transacción. Si falla, se revierte la reconstrucción. Para instalaciones nuevas se mantiene `npm run datamart:init`; para cargas posteriores, `npm run datamart:refresh` o el botón Actualizar datos. El panel y el PDF consultan el DataMart mediante las nuevas relaciones por key. Después de cambiar el código debe reiniciarse el servidor que estuviera abierto.

La prueba de integración usa las bases `_test`, asigna keys desde 1001 para que difieran de los IDs del OLTP, verifica las 28 FK y comprueba los seis indicadores. Repetir el ETL conserva las keys y no duplica dimensiones. Los escenarios simulados se revierten al terminar la prueba.
