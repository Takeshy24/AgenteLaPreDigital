-- Extensiones de integración. No elimina datos operativos existentes.
IF OBJECT_ID('dbo.App_TelegramChat', 'U') IS NULL
CREATE TABLE dbo.App_TelegramChat (
    idContacto BIGINT PRIMARY KEY REFERENCES dbo.Contacto (idContacto),
    chatId NVARCHAR(30) NOT NULL UNIQUE,
    linkedAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

IF OBJECT_ID('dbo.App_TelegramLink', 'U') IS NULL
CREATE TABLE dbo.App_TelegramLink (
    codeHash CHAR(64) PRIMARY KEY,
    idContacto BIGINT NOT NULL REFERENCES dbo.Contacto (idContacto),
    expiresAt DATETIME2(0) NOT NULL,
    usedAt DATETIME2(0) NULL
);

IF OBJECT_ID('dbo.App_TelegramInbox', 'U') IS NULL
CREATE TABLE dbo.App_TelegramInbox (
    updateId BIGINT PRIMARY KEY,
    chatId NVARCHAR(30) NOT NULL,
    payload NVARCHAR(MAX) NOT NULL,
    idMensaje BIGINT NULL REFERENCES dbo.Mensaje (idMensaje),
    receivedAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    processedAt DATETIME2(0) NULL,
    error NVARCHAR(500) NULL
);

IF OBJECT_ID('dbo.App_Dispatch', 'U') IS NULL
CREATE TABLE dbo.App_Dispatch (
    idMensaje BIGINT PRIMARY KEY REFERENCES dbo.Mensaje (idMensaje),
    state NVARCHAR(20) NOT NULL DEFAULT N'pending' CHECK (
        state IN ('pending', 'sending', 'sent', 'failed', 'unknown')
    ),
    externalId NVARCHAR(100) NULL,
    claimedAt DATETIME2(0) NULL,
    error NVARCHAR(500) NULL
);

IF OBJECT_ID('dbo.App_IntegrationCursor', 'U') IS NULL
CREATE TABLE dbo.App_IntegrationCursor (
    name NVARCHAR(50) PRIMARY KEY,
    position BIGINT NOT NULL
);

IF OBJECT_ID('dbo.App_ContactSelection', 'U') IS NULL
CREATE TABLE dbo.App_ContactSelection (
    idContacto BIGINT PRIMARY KEY REFERENCES dbo.Contacto (idContacto),
    idLeadCaso BIGINT NOT NULL REFERENCES dbo.LeadCaso (idLeadCaso)
);

IF OBJECT_ID('dbo.App_TrialLink', 'U') IS NULL
CREATE TABLE dbo.App_TrialLink (
    codeHash CHAR(64) PRIMARY KEY,
    idLeadCaso BIGINT NOT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
    expiresAt DATETIME2(0) NOT NULL,
    usedAt DATETIME2(0) NULL
);

IF OBJECT_ID('dbo.App_OperationEvidence', 'U') IS NULL
CREATE TABLE dbo.App_OperationEvidence (
    id BIGINT IDENTITY PRIMARY KEY,
    idCaso BIGINT NOT NULL REFERENCES dbo.Caso (idCaso),
    operation NVARCHAR(60) NOT NULL,
    reference NVARCHAR(300) NOT NULL,
    idOperador INT NOT NULL REFERENCES dbo.Operador (idOperador),
    createdAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

-- El esquema original impedía marcar mensajes salientes automáticos.
-- Se preservan las reglas de dirección/origen; se habilita automatización de agenda y agente.
IF NOT EXISTS (
    SELECT
        1
    FROM
        sys.check_constraints
    WHERE
        name = 'CK_Mensaje_DireccionOrigen'
) BEGIN DECLARE @constraint SYSNAME;

SELECT
    @constraint = name
FROM
    sys.check_constraints
WHERE
    parent_object_id = OBJECT_ID('dbo.Mensaje')
    AND definition LIKE '%idDireccion%'
    AND definition LIKE '%esAutomatico%';

IF @constraint IS NOT NULL BEGIN DECLARE @statement NVARCHAR(MAX) = 'ALTER TABLE dbo.Mensaje DROP CONSTRAINT ' + QUOTENAME(@constraint);

EXEC sys.sp_executesql @statement;

END;

ALTER TABLE dbo.Mensaje
ADD CONSTRAINT CK_Mensaje_DireccionOrigen CHECK (
    (
        idDireccion = 1
        AND idOrigenMensaje IS NULL
        AND idEstadoEntrega IS NULL
        AND idOperador IS NULL
    )
    OR (
        idDireccion = 2
        AND idOrigenMensaje IS NOT NULL
        AND idEstadoEntrega IS NOT NULL
        AND (
            esAutomatico = 0
            OR idOrigenMensaje IN (1, 2)
        )
    )
);

END;
