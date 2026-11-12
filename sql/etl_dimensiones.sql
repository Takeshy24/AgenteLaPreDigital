MERGE INTO
    LaPreDigital_DataMart.dbo.DimTiempo AS dim USING (
        SELECT DISTINCT
            YEAR(fechas.fecha) * 10000 + MONTH(fechas.fecha) * 100 + DAY(fechas.fecha) AS idTiempo,
            fechas.fecha,
            YEAR(fechas.fecha) AS anio,
            DATEPART(QUARTER, fechas.fecha) AS trimestre,
            MONTH(fechas.fecha) AS mes,
            DAY(fechas.fecha) AS dia
        FROM
            (
                SELECT
                    CAST(fechaInicioElegibilidad AS DATE) AS fecha
                FROM
                    LaPreDigital_OLTP.dbo.LeadCaso
                WHERE
                    fechaInicioElegibilidad IS NOT NULL
                UNION
                SELECT
                    CAST(fechaEntrega AS DATE)
                FROM
                    LaPreDigital_OLTP.dbo.Mensaje
                WHERE
                    fechaEntrega IS NOT NULL
                UNION
                SELECT
                    CAST(fechaHora AS DATE)
                FROM
                    LaPreDigital_OLTP.dbo.Mensaje
                WHERE
                    idDireccion = 1
                UNION
                SELECT
                    CAST(fechaRespuesta AS DATE)
                FROM
                    LaPreDigital_OLTP.dbo.CambioPerfil
                UNION
                SELECT
                    CAST(fechaNecesidad AS DATE)
                FROM
                    LaPreDigital_OLTP.dbo.NecesidadVinculacion
                UNION
                SELECT
                    CAST(fechaVinculacion AS DATE)
                FROM
                    LaPreDigital_OLTP.dbo.InvitacionVinculacion
                WHERE
                    fechaVinculacion IS NOT NULL
                UNION
                SELECT
                    CAST(fechaOtorgamiento AS DATE)
                FROM
                    LaPreDigital_OLTP.dbo.AutorizacionVinculacion
                UNION
                SELECT
                    CAST(fechaOtorgamiento AS DATE)
                FROM
                    LaPreDigital_OLTP.dbo.AutorizacionContacto
                WHERE
                    fechaOtorgamiento IS NOT NULL
                UNION
                SELECT
                    CAST(fechaEvaluacion AS DATE)
                FROM
                    LaPreDigital_OLTP.dbo.EvaluacionPrioridad
                UNION
                SELECT
                    CAST(fechaEvento AS DATE)
                FROM
                    LaPreDigital_OLTP.dbo.EventoCaso
            ) AS fechas
    ) AS oltp ON oltp.idTiempo = dim.idTiempo
WHEN NOT MATCHED THEN
INSERT
    (idTiempo, fecha, anio, trimestre, mes, dia)
VALUES
    (
        oltp.idTiempo,
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
WHEN NOT MATCHED THEN
INSERT
    (idPrioridad, nombre)
VALUES
    (oltp.idPrioridad, oltp.nombre);
