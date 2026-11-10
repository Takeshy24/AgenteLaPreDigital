-- Captación pública y conversación inicial persistentes.
IF COL_LENGTH('dbo.App_PublicInquiry', 'telefono') IS NULL
ALTER TABLE dbo.App_PublicInquiry
ADD telefono NVARCHAR(20) NULL,
idRolContacto TINYINT NULL REFERENCES dbo.Cat_RolContacto (id),
idContacto BIGINT NULL REFERENCES dbo.Contacto (idContacto),
idLeadCaso BIGINT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
estado NVARCHAR(30) NOT NULL DEFAULT N'Pendiente',
requestKey NVARCHAR(64) NULL,
idPlanTarifa BIGINT NULL,
idSolicitudProvisional BIGINT NULL REFERENCES dbo.SolicitudProvisional (idSolicitud);

IF NOT EXISTS (
    SELECT
        1
    FROM
        sys.indexes
    WHERE
        name = 'UX_PublicInquiry_RequestKey'
) EXEC (
    N'CREATE UNIQUE INDEX UX_PublicInquiry_RequestKey ON dbo.App_PublicInquiry(requestKey) WHERE requestKey IS NOT NULL'
);

IF OBJECT_ID('dbo.App_Onboarding', 'U') IS NULL
CREATE TABLE dbo.App_Onboarding (
    idContacto BIGINT PRIMARY KEY REFERENCES dbo.Contacto (idContacto),
    payload NVARCHAR(MAX) NOT NULL,
    step NVARCHAR(30) NOT NULL,
    idSolicitud BIGINT NOT NULL REFERENCES dbo.SolicitudProvisional (idSolicitud)
);

IF OBJECT_ID('dbo.App_AgentFailures', 'U') IS NULL
CREATE TABLE dbo.App_AgentFailures (
    idContacto BIGINT PRIMARY KEY REFERENCES dbo.Contacto (idContacto),
    consecutiveFailures INT NOT NULL DEFAULT 0
);
