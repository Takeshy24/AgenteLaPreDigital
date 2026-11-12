USE LaPreDigital_DataMart;

GO

CREATE TABLE dbo.HechoContactoInicial (
    KeyParticipacion BIGINT NOT NULL PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    KeyContacto INT NOT NULL REFERENCES dbo.DimContacto (KeyContacto),
    KeyCanal INT NULL REFERENCES dbo.DimCanal (KeyCanal),
    KeyRolContacto INT NOT NULL REFERENCES dbo.DimRolContacto (KeyRolContacto),
    KeyTiempoPrimeraEntrega INT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    KeyTiempoPrimeraRespuesta INT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    M1 TINYINT NOT NULL CHECK (M1 = 1),
    M2 TINYINT NOT NULL CHECK (M2 IN (0, 1)),
    M3 TINYINT NOT NULL CHECK (M3 IN (0, 1)),
    CHECK (M3 <= M2),
    CHECK (
        M2 = 0
        OR KeyTiempoPrimeraEntrega IS NOT NULL
    ),
    CHECK (
        M3 = 0
        OR KeyTiempoPrimeraRespuesta IS NOT NULL
    )
);

GO

CREATE TABLE dbo.HechoAmpliacionPerfil (
    KeyPregunta BIGINT NOT NULL PRIMARY KEY,
    KeyTiempo INT NOT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    KeyContacto INT NOT NULL REFERENCES dbo.DimContacto (KeyContacto),
    KeyCanal INT NOT NULL REFERENCES dbo.DimCanal (KeyCanal),
    KeyRolContacto INT NOT NULL REFERENCES dbo.DimRolContacto (KeyRolContacto),
    KeyTiempoDato INT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    M4 TINYINT NOT NULL CHECK (M4 = 1),
    M5 TINYINT NOT NULL CHECK (M5 IN (0, 1)),
    CHECK (
        M5 = 0
        OR KeyTiempoDato IS NOT NULL
    )
);

GO

CREATE TABLE dbo.HechoVinculacionEconomica (
    KeyCaso BIGINT NOT NULL,
    KeyTiempo INT NOT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    KeyContacto INT NOT NULL REFERENCES dbo.DimContacto (KeyContacto),
    KeyCanal INT NOT NULL REFERENCES dbo.DimCanal (KeyCanal),
    KeyRolContacto INT NOT NULL REFERENCES dbo.DimRolContacto (KeyRolContacto),
    KeyTiempoVinculacion INT NULL REFERENCES dbo.DimTiempo (KeyTiempo),
    M6 TINYINT NOT NULL CHECK (M6 = 1),
    M7 TINYINT NOT NULL CHECK (M7 IN (0, 1)),
    PRIMARY KEY (KeyCaso, KeyTiempo),
    CHECK (
        M7 = 0
        OR KeyTiempoVinculacion IS NOT NULL
    )
);

GO

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
