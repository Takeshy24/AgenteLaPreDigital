USE LaPreDigital_DataMart;

GO

CREATE TABLE dbo.HechoContactoInicial (
    idLeadCaso BIGINT NOT NULL PRIMARY KEY,
    idTiempo INT NOT NULL REFERENCES dbo.DimTiempo (idTiempo),
    idContacto BIGINT NOT NULL REFERENCES dbo.DimContacto (idContacto),
    idCanal TINYINT NULL REFERENCES dbo.DimCanal (idCanal),
    idRolContacto TINYINT NOT NULL REFERENCES dbo.DimRolContacto (idRolContacto),
    fechaInicioElegibilidad DATETIME2(0) NOT NULL,
    fechaPrimeraEntrega DATETIME2(0) NULL,
    fechaPrimeraRespuesta DATETIME2(0) NULL,
    M1 TINYINT NOT NULL DEFAULT 1 CHECK (M1 = 1),
    M2 TINYINT NOT NULL DEFAULT 0 CHECK (M2 IN (0, 1)),
    M3 TINYINT NOT NULL DEFAULT 0 CHECK (M3 IN (0, 1)),
    CHECK (M3 <= M2)
);

GO

CREATE TABLE dbo.HechoAmpliacionPerfil (
    idPregunta BIGINT NOT NULL PRIMARY KEY,
    idTiempo INT NOT NULL REFERENCES dbo.DimTiempo (idTiempo),
    idContacto BIGINT NOT NULL REFERENCES dbo.DimContacto (idContacto),
    idCanal TINYINT NOT NULL REFERENCES dbo.DimCanal (idCanal),
    idRolContacto TINYINT NOT NULL REFERENCES dbo.DimRolContacto (idRolContacto),
    fechaPreguntaEntregada DATETIME2(0) NOT NULL,
    fechaDatoRegistrado DATETIME2(0) NULL,
    M4 TINYINT NOT NULL DEFAULT 1 CHECK (M4 = 1),
    M5 TINYINT NOT NULL DEFAULT 0 CHECK (M5 IN (0, 1))
);

GO

CREATE TABLE dbo.HechoVinculacionEconomica (
    idCaso BIGINT NOT NULL,
    mesCohorte DATE NOT NULL,
    idNecesidad BIGINT NOT NULL UNIQUE,
    idTiempo INT NOT NULL REFERENCES dbo.DimTiempo (idTiempo),
    idContactoDeclara BIGINT NOT NULL REFERENCES dbo.DimContacto (idContacto),
    idCanal TINYINT NOT NULL REFERENCES dbo.DimCanal (idCanal),
    idRolContactoDeclara TINYINT NOT NULL REFERENCES dbo.DimRolContacto (idRolContacto),
    fechaNecesidad DATETIME2(0) NOT NULL,
    fechaVinculacionLograda DATETIME2(0) NULL,
    M6 TINYINT NOT NULL DEFAULT 1 CHECK (M6 = 1),
    M7 TINYINT NOT NULL DEFAULT 0 CHECK (M7 IN (0, 1)),
    PRIMARY KEY (idCaso, mesCohorte),
    CHECK (
        mesCohorte = DATEFROMPARTS(YEAR(fechaNecesidad), MONTH(fechaNecesidad), 1)
    )
);

GO

CREATE TABLE dbo.HechoPropuestaComercial (
    idPropuesta BIGINT NOT NULL PRIMARY KEY,
    idCaso BIGINT NOT NULL,
    idTiempo INT NOT NULL REFERENCES dbo.DimTiempo (idTiempo),
    idCanal TINYINT NOT NULL REFERENCES dbo.DimCanal (idCanal),
    idPlan TINYINT NOT NULL REFERENCES dbo.DimPlan (idPlan),
    fechaEntrega DATETIME2(0) NOT NULL,
    fechaAceptacionExpresa DATETIME2(0) NULL,
    M8 TINYINT NOT NULL DEFAULT 1 CHECK (M8 = 1),
    M9 TINYINT NOT NULL DEFAULT 0 CHECK (M9 IN (0, 1))
);

GO

CREATE TABLE dbo.HechoConversionPagada (
    idCaso BIGINT NOT NULL PRIMARY KEY,
    idEvaluacionPrimeraAlta BIGINT NOT NULL UNIQUE,
    idTiempo INT NOT NULL REFERENCES dbo.DimTiempo (idTiempo),
    idContactoPrimeraAlta BIGINT NOT NULL REFERENCES dbo.DimContacto (idContacto),
    idRolContactoPrimeraAlta TINYINT NOT NULL REFERENCES dbo.DimRolContacto (idRolContacto),
    idPrioridad TINYINT NOT NULL DEFAULT 2 REFERENCES dbo.DimPrioridad (idPrioridad),
    fechaPrimeraAlta DATETIME2(0) NOT NULL,
    fechaPagoConfirmado DATETIME2(0) NULL,
    fechaValidacionContractual DATETIME2(0) NULL,
    fechaReembolsoInvalidante DATETIME2(0) NULL,
    fechaBecaCompleta DATETIME2(0) NULL,
    M10 TINYINT NOT NULL DEFAULT 1 CHECK (M10 IN (0, 1)),
    M11 TINYINT NOT NULL DEFAULT 0 CHECK (M11 IN (0, 1)),
    CHECK (idPrioridad = 2),
    CHECK (M11 <= M10)
);
