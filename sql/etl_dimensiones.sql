MERGE INTO
    LaPreDigital_DataMart.dbo.DimTiempo AS dim USING (
        SELECT DISTINCT
            fechas.fechaHora,
            CAST(fechas.fechaHora AS DATE) AS fecha,
            YEAR(fechas.fechaHora) AS anio,
            DATEPART(QUARTER, fechas.fechaHora) AS trimestre,
            MONTH(fechas.fechaHora) AS mes,
            DAY(fechas.fechaHora) AS dia
        FROM
            (
                SELECT
                    fechaInicioElegibilidad AS fechaHora
                FROM
                    LaPreDigital_OLTP.dbo.LeadCaso
                WHERE
                    fechaInicioElegibilidad IS NOT NULL
                UNION
                SELECT
                    fechaEntrega
                FROM
                    LaPreDigital_OLTP.dbo.Mensaje
                WHERE
                    fechaEntrega IS NOT NULL
                UNION
                SELECT
                    fechaHora
                FROM
                    LaPreDigital_OLTP.dbo.Mensaje
                WHERE
                    idDireccion = 1
                UNION
                SELECT
                    fechaRespuesta
                FROM
                    LaPreDigital_OLTP.dbo.CambioPerfil
                UNION
                SELECT
                    fechaNecesidad
                FROM
                    LaPreDigital_OLTP.dbo.NecesidadVinculacion
                UNION
                SELECT
                    fechaVinculacion
                FROM
                    LaPreDigital_OLTP.dbo.InvitacionVinculacion
                WHERE
                    fechaVinculacion IS NOT NULL
                UNION
                SELECT
                    fechaOtorgamiento
                FROM
                    LaPreDigital_OLTP.dbo.AutorizacionVinculacion
                UNION
                SELECT
                    fechaOtorgamiento
                FROM
                    LaPreDigital_OLTP.dbo.AutorizacionContacto
                WHERE
                    fechaOtorgamiento IS NOT NULL
                UNION
                SELECT
                    fechaEvaluacion
                FROM
                    LaPreDigital_OLTP.dbo.EvaluacionPrioridad
                UNION
                SELECT
                    fechaEvento
                FROM
                    LaPreDigital_OLTP.dbo.EventoCaso
            ) AS fechas
    ) AS oltp ON oltp.fechaHora = dim.fechaHora
WHEN NOT MATCHED THEN
INSERT
    (fechaHora, fecha, anio, trimestre, mes, dia)
VALUES
    (
        oltp.fechaHora,
        oltp.fecha,
        oltp.anio,
        oltp.trimestre,
        oltp.mes,
        oltp.dia
    );

GO

MERGE INTO
    LaPreDigital_DataMart.dbo.DimContacto AS dim USING (
        SELECT DISTINCT
            idContacto,
            nombreCompleto
        FROM
            LaPreDigital_OLTP.dbo.Contacto
        WHERE
            nombreCompleto IS NOT NULL
    ) AS oltp ON oltp.idContacto = dim.idContacto
WHEN MATCHED
AND dim.nombreCompleto <> oltp.nombreCompleto THEN
UPDATE
SET
    nombreCompleto = oltp.nombreCompleto
WHEN NOT MATCHED THEN
INSERT
    (idContacto, nombreCompleto)
VALUES
    (oltp.idContacto, oltp.nombreCompleto);

GO

MERGE INTO
    LaPreDigital_DataMart.dbo.DimCanal AS dim USING (
        SELECT DISTINCT
            id AS idCanal,
            nombre
        FROM
            LaPreDigital_OLTP.dbo.Cat_CanalComunicacion
        WHERE
            id IN (1, 2, 3)
    ) AS oltp ON oltp.idCanal = dim.idCanal
WHEN MATCHED
AND dim.nombre <> oltp.nombre THEN
UPDATE
SET
    nombre = oltp.nombre
WHEN NOT MATCHED THEN
INSERT
    (idCanal, nombre)
VALUES
    (oltp.idCanal, oltp.nombre);

GO

MERGE INTO
    LaPreDigital_DataMart.dbo.DimRolContacto AS dim USING (
        SELECT DISTINCT
            id AS idRolContacto,
            nombre
        FROM
            LaPreDigital_OLTP.dbo.Cat_RolContacto
    ) AS oltp ON oltp.idRolContacto = dim.idRolContacto
WHEN MATCHED
AND dim.nombre <> oltp.nombre THEN
UPDATE
SET
    nombre = oltp.nombre
WHEN NOT MATCHED THEN
INSERT
    (idRolContacto, nombre)
VALUES
    (oltp.idRolContacto, oltp.nombre);

GO

MERGE INTO
    LaPreDigital_DataMart.dbo.DimPlan AS dim USING (
        SELECT DISTINCT
            idPlan,
            nombre
        FROM
            LaPreDigital_OLTP.dbo.PlanComercial
        WHERE
            idPlan IN (1, 2, 3)
    ) AS oltp ON oltp.idPlan = dim.idPlan
WHEN MATCHED
AND dim.nombre <> oltp.nombre THEN
UPDATE
SET
    nombre = oltp.nombre
WHEN NOT MATCHED THEN
INSERT
    (idPlan, nombre)
VALUES
    (oltp.idPlan, oltp.nombre);

GO

MERGE INTO
    LaPreDigital_DataMart.dbo.DimPrioridad AS dim USING (
        SELECT DISTINCT
            id AS idPrioridad,
            nombre
        FROM
            LaPreDigital_OLTP.dbo.Cat_Prioridad
    ) AS oltp ON oltp.idPrioridad = dim.idPrioridad
WHEN MATCHED
AND dim.nombre <> oltp.nombre THEN
UPDATE
SET
    nombre = oltp.nombre
WHEN NOT MATCHED THEN
INSERT
    (idPrioridad, nombre)
VALUES
    (oltp.idPrioridad, oltp.nombre);
