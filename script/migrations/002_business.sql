IF OBJECT_ID('dbo.App_ContractSnapshot', 'U') IS NULL
CREATE TABLE dbo.App_ContractSnapshot (
    idContratacion BIGINT PRIMARY KEY REFERENCES dbo.Contratacion (idContratacion),
    previousStage TINYINT NOT NULL REFERENCES dbo.Cat_EtapaBeneficiario (id)
);

IF OBJECT_ID('dbo.App_Scholarship', 'U') IS NULL
CREATE TABLE dbo.App_Scholarship (
    idCaso BIGINT PRIMARY KEY REFERENCES dbo.Caso (idCaso),
    idPlan TINYINT NOT NULL REFERENCES dbo.PlanComercial (idPlan),
    idOperador INT NOT NULL REFERENCES dbo.Operador (idOperador),
    reference NVARCHAR(300) NOT NULL,
    authorizedAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    endDate DATE NOT NULL,
    activatedAt DATETIME2(0) NULL
);

IF OBJECT_ID('dbo.App_AgentAnalysis', 'U') IS NULL
CREATE TABLE dbo.App_AgentAnalysis (
    idMensaje BIGINT PRIMARY KEY REFERENCES dbo.Mensaje (idMensaje),
    model NVARCHAR(100) NOT NULL,
    payload NVARCHAR(MAX) NOT NULL,
    createdAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_TipoEvento
    WHERE
        id = 14
)
INSERT
    dbo.Cat_TipoEvento (id, nombre)
VALUES
    (14, N'Habilitación del servicio');
