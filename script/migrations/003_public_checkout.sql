IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_CanalComunicacion
    WHERE
        id = 4
)
INSERT
    dbo.Cat_CanalComunicacion (id, nombre)
VALUES
    (4, N'Portal web');

IF OBJECT_ID('dbo.App_PublicOffer', 'U') IS NULL
CREATE TABLE dbo.App_PublicOffer (
    idOferta BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idPropuesta BIGINT NOT NULL REFERENCES dbo.PropuestaComercial (idPropuesta),
    tokenHash CHAR(64) NOT NULL UNIQUE,
    expiresAt DATETIME2(0) NOT NULL,
    createdAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

IF EXISTS (
    SELECT
        1
    FROM
        sys.columns
    WHERE
        object_id = OBJECT_ID('dbo.App_OperationEvidence')
        AND name = 'idOperador'
        AND is_nullable = 0
)
ALTER TABLE dbo.App_OperationEvidence
ALTER COLUMN idOperador INT NULL;

IF OBJECT_ID('dbo.App_PublicInquiry', 'U') IS NULL
CREATE TABLE dbo.App_PublicInquiry (
    idSolicitud BIGINT IDENTITY(1, 1) PRIMARY KEY,
    nombre NVARCHAR(150) NOT NULL,
    correo NVARCHAR(254) NOT NULL,
    beneficiario NVARCHAR(150) NOT NULL,
    esEstudiante BIT NOT NULL,
    planSolicitado NVARCHAR(80) NOT NULL,
    autorizaCorreo BIT NOT NULL,
    createdAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);
