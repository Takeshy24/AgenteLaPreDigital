-- Hechos de los cinco análisis dimensionales (informe, sección 4.5). Cada tabla declara su granularidad;
-- las medidas M1 a M11 son indicadores 0/1 y los cruces respetan la tabla 10.
-- Las columnas Key… sin dimensión propia (participación, caso, propuesta, necesidad) son dimensiones
-- degeneradas: guardan el identificador del OLTP para contar unidades únicas.
USE LaPreDigital_DataMart;

GO

-- A. Contacto inicial y respuesta (M1–M3). Grano: participación LEAD–caso.
-- Cohorte: inicio del seguimiento autorizado. Canal: el del primer intento enviado o «Sin canal».
IF OBJECT_ID('dbo.HechoContactoInicial', 'U') IS NULL
CREATE TABLE dbo.HechoContactoInicial (
    KeyParticipacion BIGINT NOT NULL PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    KeyContacto INT NOT NULL REFERENCES dbo.DimContacto (KeyContacto),
    KeyCanal INT NOT NULL REFERENCES dbo.DimCanal (KeyCanal),
    KeyRolContacto INT NOT NULL REFERENCES dbo.DimRolContacto (KeyRolContacto),
    KeyTiempoPrimeraEntrega INT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    KeyTiempoPrimeraRespuesta INT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    M1 TINYINT NOT NULL CHECK (M1 = 1),
    M2 TINYINT NOT NULL CHECK (M2 IN (0, 1)),
    M3 TINYINT NOT NULL CHECK (M3 IN (0, 1)),
    CHECK (M3 <= M2)
);

GO

-- B. Ampliación del perfil (M4–M5). Grano: contacto por mes (un contacto cuenta una vez por mes).
-- Cohorte: primera pregunta entregada en el mes; canal y rol son los de esa pregunta.
-- M5: el contacto informó un dato nuevo o actualizado dentro de las 168 horas de alguna pregunta del mes.
IF OBJECT_ID('dbo.HechoAmpliacionPerfil', 'U') IS NULL
CREATE TABLE dbo.HechoAmpliacionPerfil (
    KeyContacto INT NOT NULL REFERENCES dbo.DimContacto (KeyContacto),
    anio SMALLINT NOT NULL,
    mes TINYINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    KeyPregunta BIGINT NOT NULL UNIQUE,
    KeyTiempo INT NOT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    KeyCanal INT NOT NULL REFERENCES dbo.DimCanal (KeyCanal),
    KeyRolContacto INT NOT NULL REFERENCES dbo.DimRolContacto (KeyRolContacto),
    KeyTiempoDato INT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    M4 TINYINT NOT NULL CHECK (M4 = 1),
    M5 TINYINT NOT NULL CHECK (M5 IN (0, 1)),
    PRIMARY KEY (KeyContacto, anio, mes),
    CHECK (
        M5 = 0
        OR KeyTiempoDato IS NOT NULL
    )
);

GO

-- C. Vinculación económica autorizada (M6–M7). Grano: caso por mes, tomado de su primera necesidad
-- nueva del mes. Contacto, rol y canal: los de la participación y el mensaje que la manifestaron.
IF OBJECT_ID('dbo.HechoVinculacionEconomica', 'U') IS NULL
CREATE TABLE dbo.HechoVinculacionEconomica (
    KeyNecesidad BIGINT NOT NULL PRIMARY KEY,
    KeyCaso BIGINT NOT NULL,
    anio SMALLINT NOT NULL,
    mes TINYINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    KeyTiempo INT NOT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    KeyContacto INT NOT NULL REFERENCES dbo.DimContacto (KeyContacto),
    KeyCanal INT NOT NULL REFERENCES dbo.DimCanal (KeyCanal),
    KeyRolContacto INT NOT NULL REFERENCES dbo.DimRolContacto (KeyRolContacto),
    KeyTiempoVinculacion INT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    M6 TINYINT NOT NULL CHECK (M6 = 1),
    M7 TINYINT NOT NULL CHECK (M7 IN (0, 1)),
    UNIQUE (KeyCaso, anio, mes),
    CHECK (
        M7 = 0
        OR KeyTiempoVinculacion IS NOT NULL
    )
);

GO

-- D. Aceptación de propuestas (M8–M9). Grano: propuesta entregada, para desglosar por plan y canal.
-- M8 y M9 cuentan CASOS por mes: el total se obtiene con COUNT(DISTINCT KeyCaso) por mes, no con SUM
-- (ver consultas_kpi.sql); M9 marca la propuesta aceptada dentro de las 168 horas de su entrega.
IF OBJECT_ID('dbo.HechoPropuestaComercial', 'U') IS NULL
CREATE TABLE dbo.HechoPropuestaComercial (
    KeyPropuesta BIGINT NOT NULL PRIMARY KEY,
    KeyCaso BIGINT NOT NULL,
    KeyTiempo INT NOT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    KeyCanal INT NOT NULL REFERENCES dbo.DimCanal (KeyCanal),
    KeyPlan INT NOT NULL REFERENCES dbo.DimPlan (KeyPlan),
    KeyTiempoAceptacion INT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    M8 TINYINT NOT NULL CHECK (M8 = 1),
    M9 TINYINT NOT NULL CHECK (M9 IN (0, 1)),
    CHECK (
        M9 = 0
        OR KeyTiempoAceptacion IS NOT NULL
    )
);

GO

-- E. Conversión pagada desde prioridad Alta (M10–M11). Grano: caso único.
-- Cohorte: primera clasificación Alta del caso; contacto y rol: los de esa clasificación.
-- M10 = 0 cuando el caso se cerró por beca completa dentro de las 168 horas (queda fuera del indicador).
IF OBJECT_ID('dbo.HechoConversionPagada', 'U') IS NULL
CREATE TABLE dbo.HechoConversionPagada (
    KeyCaso BIGINT NOT NULL PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    KeyContacto INT NOT NULL REFERENCES dbo.DimContacto (KeyContacto),
    KeyRolContacto INT NOT NULL REFERENCES dbo.DimRolContacto (KeyRolContacto),
    KeyPrioridad INT NOT NULL REFERENCES dbo.DimPrioridad (KeyPrioridad),
    KeyTiempoPago INT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    KeyTiempoValidacion INT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    KeyTiempoReembolso INT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    KeyTiempoBeca INT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    M10 TINYINT NOT NULL CHECK (M10 IN (0, 1)),
    M11 TINYINT NOT NULL CHECK (M11 IN (0, 1)),
    CHECK (M11 <= M10),
    CHECK (
        M11 = 0
        OR (
            KeyTiempoPago IS NOT NULL
            AND KeyTiempoValidacion IS NOT NULL
        )
    )
);
