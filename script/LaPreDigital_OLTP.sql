IF DB_ID('LaPreDigital_OLTP') IS NULL
CREATE DATABASE LaPreDigital_OLTP;

GO

USE LaPreDigital_OLTP;

GO

IF OBJECT_ID('dbo.Cat_CanalComunicacion', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_CanalComunicacion (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_CanalCaptacion', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_CanalCaptacion (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_RolContacto', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_RolContacto (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_EtapaBeneficiario', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_EtapaBeneficiario (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_EstadoCaso', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_EstadoCaso (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_MotivoCierreCaso', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_MotivoCierreCaso (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_Prioridad', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_Prioridad (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_NivelInteres', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_NivelInteres (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_EstadoParticipacion', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_EstadoParticipacion (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_MotivoSuspension', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_MotivoSuspension (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_EstadoSolicitud', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_EstadoSolicitud (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_EstadoEntrega', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_EstadoEntrega (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_EstadoAutorizacion', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_EstadoAutorizacion (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_OrigenAutorizacion', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_OrigenAutorizacion (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_TipoCambio', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_TipoCambio (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_TipoTitular', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_TipoTitular (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_Disparador', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_Disparador (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_ReglaEvaluacion', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_ReglaEvaluacion (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_FuenteNivel', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_FuenteNivel (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_ResultadoPropuesta', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_ResultadoPropuesta (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_Modalidad', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_Modalidad (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_TipoEvento', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_TipoEvento (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_MotivoBloqueo', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_MotivoBloqueo (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_DireccionMensaje', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_DireccionMensaje (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_OrigenMensaje', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_OrigenMensaje (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_EstadoPrueba', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_EstadoPrueba (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_TipoObjecion', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_TipoObjecion (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_MotivoDerivacion', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_MotivoDerivacion (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.Cat_CampoPerfil', 'U') IS NULL BEGIN
CREATE TABLE dbo.Cat_CampoPerfil (
    id TINYINT PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE,
    idTipoTitular TINYINT NOT NULL REFERENCES dbo.Cat_TipoTitular (id)
);

END;

GO

IF OBJECT_ID('dbo.Param_Proceso', 'U') IS NULL BEGIN
CREATE TABLE dbo.Param_Proceso (
    codigo NVARCHAR(60) PRIMARY KEY,
    valor INT NOT NULL
);

END;

GO

IF OBJECT_ID('dbo.Param_AgendaIntento', 'U') IS NULL BEGIN
CREATE TABLE dbo.Param_AgendaIntento (
    numeroIntento TINYINT PRIMARY KEY,
    diaDesdeInicio TINYINT NOT NULL
);

END;

GO

IF OBJECT_ID('dbo.PlanComercial', 'U') IS NULL BEGIN
CREATE TABLE dbo.PlanComercial (
    idPlan TINYINT PRIMARY KEY,
    nombre NVARCHAR(60) NOT NULL UNIQUE
);

END;

GO

IF OBJECT_ID('dbo.PlanTarifa', 'U') IS NULL BEGIN
CREATE TABLE dbo.PlanTarifa (
    idPlanTarifa INT IDENTITY(1, 1) PRIMARY KEY,
    idPlan TINYINT NOT NULL REFERENCES dbo.PlanComercial (idPlan),
    idModalidad TINYINT NOT NULL REFERENCES dbo.Cat_Modalidad (id),
    versionCatalogo NVARCHAR(20) NOT NULL,
    precio DECIMAL(8, 2) NOT NULL CHECK (precio > 0),
    vigenciaDesde DATE NOT NULL,
    vigenciaHasta DATE NULL,
    UNIQUE (idPlan, idModalidad, versionCatalogo),
    CHECK (
        vigenciaHasta IS NULL
        OR vigenciaHasta >= vigenciaDesde
    )
);

END;

GO

IF OBJECT_ID('dbo.Operador', 'U') IS NULL BEGIN
CREATE TABLE dbo.Operador (
    idOperador INT IDENTITY(1, 1) PRIMARY KEY,
    nombreCompleto NVARCHAR(150) NOT NULL,
    rolOperador NVARCHAR(50) NOT NULL,
    activo BIT NOT NULL DEFAULT 1
);

END;

GO

IF OBJECT_ID('dbo.Contacto', 'U') IS NULL BEGIN
CREATE TABLE dbo.Contacto (
    idContacto BIGINT IDENTITY(1, 1) PRIMARY KEY,
    nombreCompleto NVARCHAR(150) NULL,
    correo NVARCHAR(254) NULL,
    telefono NVARCHAR(20) NULL,
    usuarioTelegram NVARCHAR(64) NULL,
    inicioBotTelegram BIT NOT NULL DEFAULT 0,
    fechaRegistro DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    CHECK (
        correo IS NOT NULL
        OR telefono IS NOT NULL
        OR usuarioTelegram IS NOT NULL
    ),
    CHECK (
        correo IS NULL
        OR correo NOT LIKE '% %'
    ),
    CHECK (
        telefono IS NULL
        OR telefono LIKE '+%'
    )
);

END;

GO

IF OBJECT_ID('dbo.PerfilContacto', 'U') IS NULL BEGIN
CREATE TABLE dbo.PerfilContacto (
    idContacto BIGINT PRIMARY KEY REFERENCES dbo.Contacto (idContacto),
    presupuestoMensual DECIMAL(9, 2) NULL CHECK (presupuestoMensual >= 0),
    fechaActualizacion DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

END;

GO

IF OBJECT_ID('dbo.Beneficiario', 'U') IS NULL BEGIN
CREATE TABLE dbo.Beneficiario (
    idBeneficiario BIGINT IDENTITY(1, 1) PRIMARY KEY,
    nombreCompleto NVARCHAR(150) NOT NULL,
    nombreNormalizado NVARCHAR(150) NOT NULL,
    idContactoBeneficiario BIGINT NULL REFERENCES dbo.Contacto (idContacto),
    idEtapa TINYINT NOT NULL DEFAULT 1 REFERENCES dbo.Cat_EtapaBeneficiario (id),
    fechaRegistro DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

END;

GO

IF OBJECT_ID('dbo.PerfilBeneficiario', 'U') IS NULL BEGIN
CREATE TABLE dbo.PerfilBeneficiario (
    idBeneficiario BIGINT PRIMARY KEY REFERENCES dbo.Beneficiario (idBeneficiario),
    universidadObjetivo NVARCHAR(100) NOT NULL DEFAULT N'UNT',
    carreraDeseada NVARCHAR(100) NULL,
    ultimoPuntaje DECIMAL(6, 2) NULL CHECK (ultimoPuntaje >= 0),
    disponibilidadEstudio NVARCHAR(200) NULL,
    fechaActualizacion DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

END;

GO

IF OBJECT_ID('dbo.BeneficiarioCursoDificil', 'U') IS NULL BEGIN
CREATE TABLE dbo.BeneficiarioCursoDificil (
    idBeneficiario BIGINT NOT NULL REFERENCES dbo.Beneficiario (idBeneficiario),
    curso NVARCHAR(100) NOT NULL,
    PRIMARY KEY (idBeneficiario, curso)
);

END;

GO

IF OBJECT_ID('dbo.BeneficiarioPostulacionAnterior', 'U') IS NULL BEGIN
CREATE TABLE dbo.BeneficiarioPostulacionAnterior (
    idPostulacion BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idBeneficiario BIGINT NOT NULL REFERENCES dbo.Beneficiario (idBeneficiario),
    descripcion NVARCHAR(200) NOT NULL
);

END;

GO

IF OBJECT_ID('dbo.Lead', 'U') IS NULL BEGIN
CREATE TABLE dbo.Lead (
    idLead BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idContacto BIGINT NOT NULL REFERENCES dbo.Contacto (idContacto),
    idBeneficiario BIGINT NOT NULL REFERENCES dbo.Beneficiario (idBeneficiario),
    idRolContacto TINYINT NOT NULL REFERENCES dbo.Cat_RolContacto (id),
    idCanalCaptacion TINYINT NULL REFERENCES dbo.Cat_CanalCaptacion (id),
    fechaCaptacion DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    UNIQUE (idContacto, idBeneficiario)
);

END;

GO

IF OBJECT_ID('dbo.Caso', 'U') IS NULL BEGIN
CREATE TABLE dbo.Caso (
    idCaso BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idBeneficiario BIGINT NOT NULL REFERENCES dbo.Beneficiario (idBeneficiario),
    fechaApertura DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    idEstadoCaso TINYINT NOT NULL DEFAULT 1 REFERENCES dbo.Cat_EstadoCaso (id),
    fechaCierre DATETIME2(0) NULL,
    idMotivoCierre TINYINT NULL REFERENCES dbo.Cat_MotivoCierreCaso (id),
    CHECK (
        (
            idEstadoCaso = 1
            AND fechaCierre IS NULL
            AND idMotivoCierre IS NULL
        )
        OR (
            idEstadoCaso = 2
            AND fechaCierre IS NOT NULL
            AND idMotivoCierre IS NOT NULL
        )
    )
);

END;

GO

IF OBJECT_ID('dbo.LeadCaso', 'U') IS NULL BEGIN
CREATE TABLE dbo.LeadCaso (
    idLeadCaso BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idLead BIGINT NOT NULL REFERENCES dbo.Lead (idLead),
    idCaso BIGINT NOT NULL REFERENCES dbo.Caso (idCaso),
    idRolContacto TINYINT NOT NULL REFERENCES dbo.Cat_RolContacto (id),
    fechaIncorporacion DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    fechaInicioElegibilidad DATETIME2(0) NULL,
    idNivelInteres TINYINT NOT NULL DEFAULT 1 REFERENCES dbo.Cat_NivelInteres (id),
    idPrioridadActual TINYINT NOT NULL DEFAULT 1 REFERENCES dbo.Cat_Prioridad (id),
    idEstadoParticipacion TINYINT NOT NULL DEFAULT 1 REFERENCES dbo.Cat_EstadoParticipacion (id),
    idMotivoSuspension TINYINT NULL REFERENCES dbo.Cat_MotivoSuspension (id),
    UNIQUE (idLead, idCaso),
    CHECK (
        (
            idEstadoParticipacion = 2
            AND idMotivoSuspension IS NOT NULL
        )
        OR (
            idEstadoParticipacion <> 2
            AND idMotivoSuspension IS NULL
        )
    )
);

END;

GO

IF OBJECT_ID('dbo.PruebaGratuita', 'U') IS NULL BEGIN
CREATE TABLE dbo.PruebaGratuita (
    idPrueba BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idBeneficiario BIGINT NOT NULL UNIQUE REFERENCES dbo.Beneficiario (idBeneficiario),
    idLeadCaso BIGINT NOT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
    fechaInicio DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    fechaFin DATETIME2(0) NOT NULL,
    idEstadoPrueba TINYINT NOT NULL DEFAULT 1 REFERENCES dbo.Cat_EstadoPrueba (id),
    CHECK (fechaFin > fechaInicio)
);

END;

GO

IF OBJECT_ID('dbo.AutorizacionContacto', 'U') IS NULL BEGIN
CREATE TABLE dbo.AutorizacionContacto (
    idAutorizacion BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idContacto BIGINT NOT NULL REFERENCES dbo.Contacto (idContacto),
    idCanal TINYINT NOT NULL REFERENCES dbo.Cat_CanalComunicacion (id),
    idEstadoAutorizacion TINYINT NOT NULL REFERENCES dbo.Cat_EstadoAutorizacion (id),
    fechaOtorgamiento DATETIME2(0) NULL,
    fechaRevocacion DATETIME2(0) NULL,
    idOrigenAutorizacion TINYINT NOT NULL REFERENCES dbo.Cat_OrigenAutorizacion (id),
    versionTexto NVARCHAR(30) NOT NULL,
    CHECK (
        (
            idEstadoAutorizacion = 1
            AND fechaOtorgamiento IS NOT NULL
            AND fechaRevocacion IS NULL
        )
        OR (
            idEstadoAutorizacion = 2
            AND fechaOtorgamiento IS NOT NULL
            AND fechaRevocacion >= fechaOtorgamiento
        )
        OR (
            idEstadoAutorizacion = 3
            AND fechaOtorgamiento IS NULL
            AND fechaRevocacion IS NULL
        )
    )
);

END;

GO

IF OBJECT_ID('dbo.SolicitudProvisional', 'U') IS NULL BEGIN
CREATE TABLE dbo.SolicitudProvisional (
    idSolicitud BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idContacto BIGINT NOT NULL REFERENCES dbo.Contacto (idContacto),
    idRolContacto TINYINT NULL REFERENCES dbo.Cat_RolContacto (id),
    idCanalCaptacion TINYINT NOT NULL REFERENCES dbo.Cat_CanalCaptacion (id),
    fechaSolicitud DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    textoSolicitud NVARCHAR(MAX) NOT NULL,
    idEstadoSolicitud TINYINT NOT NULL DEFAULT 1 REFERENCES dbo.Cat_EstadoSolicitud (id),
    idBeneficiarioVinculado BIGINT NULL REFERENCES dbo.Beneficiario (idBeneficiario),
    fechaVinculacion DATETIME2(0) NULL,
    CHECK (
        (
            idEstadoSolicitud = 2
            AND idBeneficiarioVinculado IS NOT NULL
            AND fechaVinculacion IS NOT NULL
        )
        OR (
            idEstadoSolicitud <> 2
            AND idBeneficiarioVinculado IS NULL
            AND fechaVinculacion IS NULL
        )
    )
);

END;

GO

IF OBJECT_ID('dbo.Mensaje', 'U') IS NULL BEGIN
CREATE TABLE dbo.Mensaje (
    idMensaje BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idContacto BIGINT NOT NULL REFERENCES dbo.Contacto (idContacto),
    idLead BIGINT NULL REFERENCES dbo.Lead (idLead),
    idLeadCaso BIGINT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
    idDireccion TINYINT NOT NULL REFERENCES dbo.Cat_DireccionMensaje (id),
    idCanal TINYINT NOT NULL REFERENCES dbo.Cat_CanalComunicacion (id),
    fechaHora DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    idOrigenMensaje TINYINT NULL REFERENCES dbo.Cat_OrigenMensaje (id),
    idAutorizacionAlEnvio BIGINT NULL REFERENCES dbo.AutorizacionContacto (idAutorizacion),
    idMensajeRespondido BIGINT NULL REFERENCES dbo.Mensaje (idMensaje),
    idOperador INT NULL REFERENCES dbo.Operador (idOperador),
    esAutomatico BIT NOT NULL DEFAULT 0,
    usaPlantilla BIT NOT NULL DEFAULT 0,
    textoMensaje NVARCHAR(MAX) NOT NULL,
    idEstadoEntrega TINYINT NULL REFERENCES dbo.Cat_EstadoEntrega (id),
    fechaEntrega DATETIME2(0) NULL,
    CHECK (
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
            AND esAutomatico = 0
        )
    ),
    CHECK (
        idDireccion = 1
        OR idMensajeRespondido IS NOT NULL
        OR idAutorizacionAlEnvio IS NOT NULL
    ),
    CHECK (
        idOrigenMensaje IS NULL
        OR idOrigenMensaje <> 2
        OR idMensajeRespondido IS NOT NULL
    ),
    CHECK (
        idOrigenMensaje IS NULL
        OR idOrigenMensaje <> 3
        OR idOperador IS NOT NULL
    ),
    CHECK (
        (
            idEstadoEntrega = 2
            AND fechaEntrega IS NOT NULL
        )
        OR (
            (
                idEstadoEntrega IS NULL
                OR idEstadoEntrega <> 2
            )
            AND fechaEntrega IS NULL
        )
    )
);

END;

GO

IF OBJECT_ID('dbo.IntentoContacto', 'U') IS NULL BEGIN
CREATE TABLE dbo.IntentoContacto (
    idIntento BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idLeadCaso BIGINT NOT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
    numeroIntento TINYINT NOT NULL REFERENCES dbo.Param_AgendaIntento (numeroIntento),
    fechaProgramada DATETIME2(0) NOT NULL,
    idMensajeEnvio BIGINT NULL REFERENCES dbo.Mensaje (idMensaje),
    omitido BIT NOT NULL DEFAULT 0,
    idMensajeRespuesta BIGINT NULL REFERENCES dbo.Mensaje (idMensaje),
    UNIQUE (idLeadCaso, numeroIntento),
    CHECK (
        NOT (
            omitido = 1
            AND idMensajeEnvio IS NOT NULL
        )
    ),
    CHECK (
        idMensajeRespuesta IS NULL
        OR idMensajeEnvio IS NOT NULL
    )
);

END;

GO

IF OBJECT_ID('dbo.Derivacion', 'U') IS NULL BEGIN
CREATE TABLE dbo.Derivacion (
    idDerivacion BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idContacto BIGINT NOT NULL REFERENCES dbo.Contacto (idContacto),
    idMotivoDerivacion TINYINT NOT NULL REFERENCES dbo.Cat_MotivoDerivacion (id),
    idMensajeOrigen BIGINT NULL REFERENCES dbo.Mensaje (idMensaje),
    fechaInicio DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    idOperador INT NULL REFERENCES dbo.Operador (idOperador),
    fechaRetomaAgente DATETIME2(0) NULL,
    fechaAtencion DATETIME2(0) NULL,
    CHECK (
        fechaRetomaAgente IS NULL
        OR fechaRetomaAgente >= fechaInicio
    ),
    CHECK (
        fechaAtencion IS NULL
        OR (
            fechaAtencion >= fechaInicio
            AND idOperador IS NOT NULL
        )
    )
);

END;

GO

IF OBJECT_ID('dbo.PreguntaPerfil', 'U') IS NULL BEGIN
CREATE TABLE dbo.PreguntaPerfil (
    idPregunta BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idLeadCaso BIGINT NOT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
    idContacto BIGINT NOT NULL REFERENCES dbo.Contacto (idContacto),
    idCampoPerfil TINYINT NOT NULL REFERENCES dbo.Cat_CampoPerfil (id),
    idMensajePregunta BIGINT NOT NULL REFERENCES dbo.Mensaje (idMensaje),
    fechaPregunta DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

END;

GO

IF OBJECT_ID('dbo.CambioPerfil', 'U') IS NULL BEGIN
CREATE TABLE dbo.CambioPerfil (
    idCambio BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idPregunta BIGINT NULL REFERENCES dbo.PreguntaPerfil (idPregunta),
    idLeadCaso BIGINT NOT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
    idContactoInformante BIGINT NOT NULL REFERENCES dbo.Contacto (idContacto),
    idTipoTitular TINYINT NOT NULL REFERENCES dbo.Cat_TipoTitular (id),
    idContactoTitular BIGINT NULL REFERENCES dbo.Contacto (idContacto),
    idBeneficiarioTitular BIGINT NULL REFERENCES dbo.Beneficiario (idBeneficiario),
    idCampoPerfil TINYINT NOT NULL REFERENCES dbo.Cat_CampoPerfil (id),
    fechaRespuesta DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    datoPrevio NVARCHAR(500) NULL,
    datoNuevo NVARCHAR(500) NOT NULL,
    idTipoCambio TINYINT NOT NULL REFERENCES dbo.Cat_TipoCambio (id),
    idCanal TINYINT NOT NULL REFERENCES dbo.Cat_CanalComunicacion (id),
    idRolReferencia TINYINT NOT NULL REFERENCES dbo.Cat_RolContacto (id),
    idMensajeRespuesta BIGINT NULL REFERENCES dbo.Mensaje (idMensaje),
    idOperadorCorrige INT NULL REFERENCES dbo.Operador (idOperador),
    CHECK (
        (
            idTipoTitular = 1
            AND idContactoTitular IS NOT NULL
            AND idBeneficiarioTitular IS NULL
        )
        OR (
            idTipoTitular = 2
            AND idBeneficiarioTitular IS NOT NULL
            AND idContactoTitular IS NULL
        )
    ),
    CHECK (
        (
            idTipoCambio = 3
            AND idOperadorCorrige IS NOT NULL
        )
        OR (
            idTipoCambio <> 3
            AND idOperadorCorrige IS NULL
        )
    ),
    CHECK (
        datoPrevio IS NULL
        OR datoPrevio <> datoNuevo
    )
);

END;

GO

IF OBJECT_ID('dbo.ObjecionComercial', 'U') IS NULL BEGIN
CREATE TABLE dbo.ObjecionComercial (
    idObjecion BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idLeadCaso BIGINT NOT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
    idTipoObjecion TINYINT NOT NULL REFERENCES dbo.Cat_TipoObjecion (id),
    detalle NVARCHAR(500) NULL,
    idMensajeEvidencia BIGINT NULL REFERENCES dbo.Mensaje (idMensaje),
    fechaRegistro DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

END;

GO

IF OBJECT_ID('dbo.NecesidadVinculacion', 'U') IS NULL BEGIN
CREATE TABLE dbo.NecesidadVinculacion (
    idNecesidad BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idCaso BIGINT NOT NULL REFERENCES dbo.Caso (idCaso),
    idLeadCasoDeclara BIGINT NOT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
    idMensajeEvidencia BIGINT NOT NULL REFERENCES dbo.Mensaje (idMensaje),
    fechaNecesidad DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

END;

GO

IF OBJECT_ID('dbo.InvitacionVinculacion', 'U') IS NULL BEGIN
CREATE TABLE dbo.InvitacionVinculacion (
    idInvitacion BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idNecesidad BIGINT NOT NULL REFERENCES dbo.NecesidadVinculacion (idNecesidad),
    nombreInvitado NVARCHAR(150) NOT NULL,
    telefonoInvitado NVARCHAR(20) NULL,
    idRolInvitado TINYINT NOT NULL REFERENCES dbo.Cat_RolContacto (id),
    codigoEnlace UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() UNIQUE,
    idResponsable BIGINT NULL REFERENCES dbo.Contacto (idContacto),
    idLeadCasoResponsable BIGINT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
    fechaInvitacion DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    fechaVinculacion DATETIME2(0) NULL,
    CHECK (
        fechaVinculacion IS NULL
        OR (
            idResponsable IS NOT NULL
            AND idLeadCasoResponsable IS NOT NULL
            AND fechaVinculacion >= fechaInvitacion
        )
    )
);

END;

GO

IF OBJECT_ID('dbo.AutorizacionVinculacion', 'U') IS NULL BEGIN
CREATE TABLE dbo.AutorizacionVinculacion (
    idAutorizacionVinculacion BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idInvitacion BIGINT NOT NULL REFERENCES dbo.InvitacionVinculacion (idInvitacion),
    idEstadoAutorizacion TINYINT NOT NULL REFERENCES dbo.Cat_EstadoAutorizacion (id),
    fechaOtorgamiento DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    fechaRevocacion DATETIME2(0) NULL,
    CHECK (
        (
            idEstadoAutorizacion = 1
            AND fechaRevocacion IS NULL
        )
        OR (
            idEstadoAutorizacion = 2
            AND fechaRevocacion >= fechaOtorgamiento
        )
    )
);

END;

GO

IF OBJECT_ID('dbo.PropuestaComercial', 'U') IS NULL BEGIN
CREATE TABLE dbo.PropuestaComercial (
    idPropuesta BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idCaso BIGINT NOT NULL REFERENCES dbo.Caso (idCaso),
    idLeadCasoEntrega BIGINT NOT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
    idLeadCasoAcepta BIGINT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
    idPlanTarifa INT NOT NULL REFERENCES dbo.PlanTarifa (idPlanTarifa),
    precioAutorizado DECIMAL(8, 2) NOT NULL CHECK (precioAutorizado > 0),
    idOperadorAprueba INT NULL REFERENCES dbo.Operador (idOperador),
    idMensajeEntrega BIGINT NOT NULL REFERENCES dbo.Mensaje (idMensaje),
    idMensajeRespuesta BIGINT NULL REFERENCES dbo.Mensaje (idMensaje),
    idResultado TINYINT NULL REFERENCES dbo.Cat_ResultadoPropuesta (id),
    aceptacionExpresa BIT NOT NULL DEFAULT 0,
    aceptadaEnPasarela BIT NOT NULL DEFAULT 0,
    CHECK (
        idResultado IS NULL
        OR idResultado <> 1
        OR (
            idLeadCasoAcepta IS NOT NULL
            AND aceptacionExpresa = 1
        )
    ),
    CHECK (
        aceptacionExpresa = 0
        OR idResultado = 1
    ),
    CHECK (
        aceptadaEnPasarela = 0
        OR aceptacionExpresa = 1
    ),
    CHECK (
        aceptacionExpresa = 0
        OR aceptadaEnPasarela = 1
        OR idMensajeRespuesta IS NOT NULL
    )
);

END;

GO

IF OBJECT_ID('dbo.EvaluacionPrioridad', 'U') IS NULL BEGIN
CREATE TABLE dbo.EvaluacionPrioridad (
    idEvaluacion BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idLeadCaso BIGINT NOT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
    fechaEvaluacion DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    idPrioridadAnterior TINYINT NOT NULL REFERENCES dbo.Cat_Prioridad (id),
    idPrioridadAsignada TINYINT NOT NULL REFERENCES dbo.Cat_Prioridad (id),
    idNivelInteres TINYINT NOT NULL REFERENCES dbo.Cat_NivelInteres (id),
    idReglaAplicada TINYINT NOT NULL REFERENCES dbo.Cat_ReglaEvaluacion (id),
    idDisparador TINYINT NOT NULL REFERENCES dbo.Cat_Disparador (id),
    idFuenteNivel TINYINT NOT NULL REFERENCES dbo.Cat_FuenteNivel (id),
    idMensajeEvidencia BIGINT NULL REFERENCES dbo.Mensaje (idMensaje),
    idEvaluacionCorregida BIGINT NULL REFERENCES dbo.EvaluacionPrioridad (idEvaluacion),
    idOperador INT NULL REFERENCES dbo.Operador (idOperador),
    intentosSinRespuesta TINYINT NOT NULL CHECK (intentosSinRespuesta BETWEEN 0 AND 7),
    seguimientoPermitido BIT NOT NULL,
    CHECK (idPrioridadAsignada <> 1),
    CHECK (
        (
            idFuenteNivel = 3
            AND idOperador IS NOT NULL
        )
        OR (
            idFuenteNivel <> 3
            AND idOperador IS NULL
        )
    ),
    CHECK (
        idEvaluacionCorregida IS NULL
        OR idFuenteNivel = 3
    )
);

END;

GO

IF OBJECT_ID('dbo.EventoCaso', 'U') IS NULL BEGIN
CREATE TABLE dbo.EventoCaso (
    idEvento BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idCaso BIGINT NOT NULL REFERENCES dbo.Caso (idCaso),
    idTipoEvento TINYINT NOT NULL REFERENCES dbo.Cat_TipoEvento (id),
    fechaEvento DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    idLeadCasoAtribuido BIGINT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
    idPropuestaAceptada BIGINT NULL REFERENCES dbo.PropuestaComercial (idPropuesta),
    idEtapaResultante TINYINT NULL REFERENCES dbo.Cat_EtapaBeneficiario (id),
    idEstadoCasoResultante TINYINT NULL REFERENCES dbo.Cat_EstadoCaso (id),
    idMotivoCierre TINYINT NULL REFERENCES dbo.Cat_MotivoCierreCaso (id),
    idEventoCorregido BIGINT NULL REFERENCES dbo.EventoCaso (idEvento),
    motivoCorreccion NVARCHAR(300) NULL,
    idOperador INT NULL REFERENCES dbo.Operador (idOperador),
    CHECK (
        (
            idTipoEvento = 3
            AND idMotivoCierre IS NOT NULL
            AND idEstadoCasoResultante = 2
        )
        OR (
            idTipoEvento <> 3
            AND idMotivoCierre IS NULL
        )
    ),
    CHECK (
        idEstadoCasoResultante IS NULL
        OR (
            idEstadoCasoResultante = 2
            AND idTipoEvento = 3
        )
        OR (
            idEstadoCasoResultante = 1
            AND idTipoEvento = 4
        )
    ),
    CHECK (
        (
            idTipoEvento = 13
            AND idEventoCorregido IS NOT NULL
            AND motivoCorreccion IS NOT NULL
            AND idOperador IS NOT NULL
        )
        OR (
            idTipoEvento <> 13
            AND idEventoCorregido IS NULL
        )
    ),
    CHECK (
        idTipoEvento <> 5
        OR (
            idPropuestaAceptada IS NOT NULL
            AND idLeadCasoAtribuido IS NOT NULL
        )
    ),
    CHECK (
        idTipoEvento NOT IN (7, 8)
        OR idOperador IS NOT NULL
    ),
    CHECK (
        idTipoEvento <> 10
        OR (
            idEtapaResultante IS NULL
            AND idEstadoCasoResultante IS NULL
        )
    )
);

END;

GO

IF OBJECT_ID('dbo.Contratacion', 'U') IS NULL BEGIN
CREATE TABLE dbo.Contratacion (
    idContratacion BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idCaso BIGINT NOT NULL UNIQUE REFERENCES dbo.Caso (idCaso),
    idPropuestaAceptada BIGINT NOT NULL REFERENCES dbo.PropuestaComercial (idPropuesta),
    idEventoAceptacion BIGINT NOT NULL REFERENCES dbo.EventoCaso (idEvento),
    idEventoPago BIGINT NULL REFERENCES dbo.EventoCaso (idEvento),
    idEventoValidacion BIGINT NULL REFERENCES dbo.EventoCaso (idEvento),
    referenciaPago NVARCHAR(100) NULL,
    importeConfirmado DECIMAL(8, 2) NULL,
    fechaHabilitacion DATETIME2(0) NULL,
    servicioPrestado AS (
        CASE
            WHEN fechaHabilitacion IS NULL THEN 0
            ELSE 1
        END
    ),
    CHECK (
        (
            idEventoPago IS NULL
            AND importeConfirmado IS NULL
            AND referenciaPago IS NULL
        )
        OR (
            idEventoPago IS NOT NULL
            AND importeConfirmado > 0
            AND referenciaPago IS NOT NULL
        )
    ),
    CHECK (
        idEventoValidacion IS NULL
        OR idEventoPago IS NOT NULL
    )
);

END;

GO

IF OBJECT_ID('dbo.BecaCompleta', 'U') IS NULL BEGIN
CREATE TABLE dbo.BecaCompleta (
    idEvento BIGINT PRIMARY KEY REFERENCES dbo.EventoCaso (idEvento),
    idPlan TINYINT NOT NULL REFERENCES dbo.PlanComercial (idPlan),
    fechaAutorizacion DATETIME2(0) NOT NULL,
    idOperadorAutoriza INT NOT NULL REFERENCES dbo.Operador (idOperador),
    fechaFinVigencia DATE NOT NULL,
    fechaHabilitacion DATETIME2(0) NOT NULL,
    CHECK (fechaHabilitacion >= fechaAutorizacion)
);

END;

GO

IF OBJECT_ID('dbo.BloqueoPromocional', 'U') IS NULL BEGIN
CREATE TABLE dbo.BloqueoPromocional (
    idBloqueo BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idBeneficiario BIGINT NOT NULL REFERENCES dbo.Beneficiario (idBeneficiario),
    idMotivoBloqueo TINYINT NOT NULL REFERENCES dbo.Cat_MotivoBloqueo (id),
    idEventoOrigen BIGINT NOT NULL REFERENCES dbo.EventoCaso (idEvento),
    fechaInicio DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    fechaFin DATETIME2(0) NULL,
    idMensajeFin BIGINT NULL REFERENCES dbo.Mensaje (idMensaje),
    CHECK (
        (
            fechaFin IS NULL
            AND idMensajeFin IS NULL
        )
        OR (
            fechaFin >= fechaInicio
            AND idMensajeFin IS NOT NULL
        )
    )
);

END;

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_CanalComunicacion
)
INSERT INTO
    dbo.Cat_CanalComunicacion (id, nombre)
VALUES
    (1, N'WhatsApp'),
    (2, N'Correo electrónico'),
    (3, N'Telegram'),
    (4, N'Portal web');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_CanalCaptacion
)
INSERT INTO
    dbo.Cat_CanalCaptacion (id, nombre)
VALUES
    (1, N'Landing page'),
    (2, N'Redes sociales'),
    (3, N'Anuncio digital'),
    (4, N'Referido'),
    (5, N'Mensaje directo');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_RolContacto
)
INSERT INTO
    dbo.Cat_RolContacto (id, nombre)
VALUES
    (1, N'Estudiante'),
    (2, N'Padre'),
    (3, N'Madre'),
    (4, N'Apoderado');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_EtapaBeneficiario
)
INSERT INTO
    dbo.Cat_EtapaBeneficiario (id, nombre)
VALUES
    (1, N'LEADS'),
    (2, N'PAYER'),
    (3, N'CUSTOMER');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_EstadoCaso
)
INSERT INTO
    dbo.Cat_EstadoCaso (id, nombre)
VALUES
    (1, N'Abierto'),
    (2, N'Cerrado');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_MotivoCierreCaso
)
INSERT INTO
    dbo.Cat_MotivoCierreCaso (id, nombre)
VALUES
    (1, N'Contratación pagada'),
    (2, N'Beca completa'),
    (3, N'Desistimiento expreso'),
    (4, N'Sin seguimiento viable');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_Prioridad
)
INSERT INTO
    dbo.Cat_Prioridad (id, nombre)
VALUES
    (1, N'Pendiente'),
    (2, N'Alta'),
    (3, N'Media'),
    (4, N'Baja'),
    (5, N'Nula');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_NivelInteres
)
INSERT INTO
    dbo.Cat_NivelInteres (id, nombre)
VALUES
    (1, N'Ninguno'),
    (2, N'Consulta'),
    (3, N'Compra'),
    (4, N'Intento de compra');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_EstadoParticipacion
)
INSERT INTO
    dbo.Cat_EstadoParticipacion (id, nombre)
VALUES
    (1, N'Activa'),
    (2, N'Suspendida'),
    (3, N'Finalizada'),
    (4, N'Convertida');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_MotivoSuspension
)
INSERT INTO
    dbo.Cat_MotivoSuspension (id, nombre)
VALUES
    (1, N'Sin respuesta'),
    (2, N'Sin autorización');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_EstadoSolicitud
)
INSERT INTO
    dbo.Cat_EstadoSolicitud (id, nombre)
VALUES
    (1, N'Pendiente'),
    (2, N'Vinculada'),
    (3, N'Descartada');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_EstadoEntrega
)
INSERT INTO
    dbo.Cat_EstadoEntrega (id, nombre)
VALUES
    (1, N'Pendiente'),
    (2, N'Entregado'),
    (3, N'Fallido');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_EstadoAutorizacion
)
INSERT INTO
    dbo.Cat_EstadoAutorizacion (id, nombre)
VALUES
    (1, N'Vigente'),
    (2, N'Revocada'),
    (3, N'Denegada');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_OrigenAutorizacion
)
INSERT INTO
    dbo.Cat_OrigenAutorizacion (id, nombre)
VALUES
    (1, N'Formulario'),
    (2, N'Vinculación'),
    (3, N'Chat');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_TipoCambio
)
INSERT INTO
    dbo.Cat_TipoCambio (id, nombre)
VALUES
    (1, N'Dato nuevo'),
    (2, N'Corrección'),
    (3, N'Error de extracción');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_TipoTitular
)
INSERT INTO
    dbo.Cat_TipoTitular (id, nombre)
VALUES
    (1, N'Contacto'),
    (2, N'Beneficiario');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_Disparador
)
INSERT INTO
    dbo.Cat_Disparador (id, nombre)
VALUES
    (1, N'Evaluación inicial'),
    (2, N'Respuesta'),
    (3, N'Reevaluación semanal'),
    (4, N'Vencimiento del plazo de un intento'),
    (5, N'Reactivación'),
    (6, N'Cambio de nivel por regla del sistema'),
    (7, N'Corrección del personal comercial');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_ReglaEvaluacion
)
INSERT INTO
    dbo.Cat_ReglaEvaluacion (id, nombre)
VALUES
    (1, N'Contador en umbral de Nula'),
    (2, N'Contador en umbral de Baja'),
    (3, N'Nivel Compra'),
    (4, N'Nivel Consulta'),
    (5, N'Nivel Ninguno');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_FuenteNivel
)
INSERT INTO
    dbo.Cat_FuenteNivel (id, nombre)
VALUES
    (1, N'Agente'),
    (2, N'Sistema'),
    (3, N'Personal comercial');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_ResultadoPropuesta
)
INSERT INTO
    dbo.Cat_ResultadoPropuesta (id, nombre)
VALUES
    (1, N'Aceptada'),
    (2, N'Rechazada'),
    (3, N'Sin respuesta');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_Modalidad
)
INSERT INTO
    dbo.Cat_Modalidad (id, nombre)
VALUES
    (1, N'Mensual'),
    (2, N'Semestral');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_TipoEvento
)
INSERT INTO
    dbo.Cat_TipoEvento (id, nombre)
VALUES
    (1, N'Ingreso a LEADS'),
    (2, N'Apertura de caso'),
    (3, N'Cierre de caso'),
    (4, N'Reapertura de caso'),
    (5, N'Aceptación de condiciones de contratación'),
    (6, N'Pago confirmado'),
    (7, N'Contratación validada'),
    (8, N'Beca completa'),
    (9, N'Reembolso invalidante'),
    (10, N'Reembolso parcial o posterior al servicio'),
    (11, N'Disputa de pago'),
    (12, N'Resolución de disputa'),
    (13, N'Corrección de evento'),
    (14, N'Habilitación del servicio');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_MotivoBloqueo
)
INSERT INTO
    dbo.Cat_MotivoBloqueo (id, nombre)
VALUES
    (1, N'Reembolso invalidante'),
    (2, N'Disputa de pago');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_DireccionMensaje
)
INSERT INTO
    dbo.Cat_DireccionMensaje (id, nombre)
VALUES
    (1, N'Entrante'),
    (2, N'Saliente');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_OrigenMensaje
)
INSERT INTO
    dbo.Cat_OrigenMensaje (id, nombre)
VALUES
    (1, N'Agenda'),
    (2, N'Respuesta del agente'),
    (3, N'Personal comercial');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_EstadoPrueba
)
INSERT INTO
    dbo.Cat_EstadoPrueba (id, nombre)
VALUES
    (1, N'Activa'),
    (2, N'Finalizada');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_TipoObjecion
)
INSERT INTO
    dbo.Cat_TipoObjecion (id, nombre)
VALUES
    (1, N'Precio'),
    (2, N'Confianza'),
    (3, N'Tiempo'),
    (4, N'Características'),
    (5, N'Alternativas');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_MotivoDerivacion
)
INSERT INTO
    dbo.Cat_MotivoDerivacion (id, nombre)
VALUES
    (1, N'Pide hablar con una persona'),
    (2, N'Reclamo'),
    (3, N'Pedido de reembolso'),
    (4, N'Disputa'),
    (5, N'Pago no confirmado'),
    (6, N'Pide descuento o beca'),
    (7, N'No logra interpretar los mensajes');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Cat_CampoPerfil
)
INSERT INTO
    dbo.Cat_CampoPerfil (id, nombre, idTipoTitular)
VALUES
    (1, N'Universidad objetivo', 2),
    (2, N'Carrera deseada', 2),
    (3, N'Cursos y temas difíciles', 2),
    (4, N'Postulaciones anteriores', 2),
    (5, N'Último puntaje', 2),
    (6, N'Disponibilidad de estudio', 2),
    (7, N'Presupuesto mensual aproximado', 1);

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Param_Proceso
)
INSERT INTO
    dbo.Param_Proceso (codigo, valor)
VALUES
    (N'EVALUACION_INICIAL_HORAS', 24),
    (N'UMBRAL_BAJA', 3),
    (N'UMBRAL_NULA', 7),
    (N'REEVALUACION_DIAS', 7),
    (N'VENTANA_MEDICION_HORAS', 168),
    (N'PLAZO_RESPUESTA_TRAS_SEPTIMO_DIAS', 7),
    (N'PLAZO_RESPUESTA_PROPUESTA_DIAS', 7),
    (N'INACTIVIDAD_CASO_DIAS', 30),
    (N'REAPERTURA_DIAS', 30),
    (N'ATENCION_DERIVACION_HORAS', 24),
    (N'DURACION_EXPLORA_DIAS', 14);

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.Param_AgendaIntento
)
INSERT INTO
    dbo.Param_AgendaIntento (numeroIntento, diaDesdeInicio)
VALUES
    (1, 0),
    (2, 1),
    (3, 2),
    (4, 5),
    (5, 10),
    (6, 17),
    (7, 27);

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.PlanComercial
)
INSERT INTO
    dbo.PlanComercial (idPlan, nombre)
VALUES
    (1, N'Ruta UNT'),
    (2, N'Meta UNT'),
    (3, N'Meta UNT Plus');

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.PlanTarifa
)
INSERT INTO
    dbo.PlanTarifa (
        idPlan,
        idModalidad,
        versionCatalogo,
        precio,
        vigenciaDesde
    )
VALUES
    (1, 1, N'v1', 39.90, '2026-01-01'),
    (2, 1, N'v1', 79.90, '2026-01-01'),
    (2, 2, N'v1', 399.90, '2026-01-01'),
    (3, 1, N'v1', 99.90, '2026-01-01'),
    (3, 2, N'v1', 499.90, '2026-01-01');

GO

DROP
TRIGGER IF EXISTS dbo.trg_Contacto_CorreoUnico;

GO

CREATE
TRIGGER dbo.trg_Contacto_CorreoUnico ON dbo.Contacto AFTER
INSERT
,
UPDATE AS BEGIN IF EXISTS (
    SELECT
        c.correo
    FROM
        dbo.Contacto c
    WHERE
        c.correo IS NOT NULL
        AND c.correo IN (
            SELECT
                correo
            FROM
                inserted
        )
    GROUP BY
        c.correo
    HAVING
        COUNT(*) > 1
) BEGIN RAISERROR (N'Ya existe un contacto con ese correo.', 16, 1);

ROLLBACK TRANSACTION;

END END;

GO

DROP
TRIGGER IF EXISTS dbo.trg_Caso_UnCasoAbierto;

GO

CREATE
TRIGGER dbo.trg_Caso_UnCasoAbierto ON dbo.Caso AFTER
INSERT
,
UPDATE AS BEGIN IF EXISTS (
    SELECT
        c.idBeneficiario
    FROM
        dbo.Caso c
    WHERE
        c.idEstadoCaso = 1
        AND c.idBeneficiario IN (
            SELECT
                idBeneficiario
            FROM
                inserted
        )
    GROUP BY
        c.idBeneficiario
    HAVING
        COUNT(*) > 1
) BEGIN RAISERROR (
    N'El beneficiario ya tiene un caso abierto.',
    16,
    1
);

ROLLBACK TRANSACTION;

END END;

GO

DROP
TRIGGER IF EXISTS dbo.trg_AutorizacionContacto_UnaVigente;

GO

CREATE
TRIGGER dbo.trg_AutorizacionContacto_UnaVigente ON dbo.AutorizacionContacto AFTER
INSERT
,
UPDATE AS BEGIN IF EXISTS (
    SELECT
        a.idContacto,
        a.idCanal
    FROM
        dbo.AutorizacionContacto a
        JOIN inserted i ON i.idContacto = a.idContacto
        AND i.idCanal = a.idCanal
    WHERE
        a.idEstadoAutorizacion = 1
    GROUP BY
        a.idContacto,
        a.idCanal
    HAVING
        COUNT(DISTINCT a.idAutorizacion) > 1
) BEGIN RAISERROR (
    N'El contacto ya tiene una autorización vigente en ese canal.',
    16,
    1
);

ROLLBACK TRANSACTION;

END END;

GO

DROP
TRIGGER IF EXISTS dbo.trg_PlanTarifa_PrecioFijo;

GO

CREATE
TRIGGER dbo.trg_PlanTarifa_PrecioFijo ON dbo.PlanTarifa AFTER
UPDATE AS BEGIN IF
UPDATE (precio)
OR
UPDATE (idPlan)
OR
UPDATE (idModalidad)
OR
UPDATE (versionCatalogo) BEGIN RAISERROR (
    N'Una tarifa no se modifica: registre una nueva versión.',
    16,
    1
);

ROLLBACK TRANSACTION;

END END;

GO

DROP
TRIGGER IF EXISTS dbo.trg_EvaluacionPrioridad_SoloInsercion;

GO

CREATE
TRIGGER dbo.trg_EvaluacionPrioridad_SoloInsercion ON dbo.EvaluacionPrioridad INSTEAD OF
UPDATE,
DELETE AS BEGIN RAISERROR (
    N'Las evaluaciones no se modifican ni se eliminan.',
    16,
    1
);

END;

GO

DROP
TRIGGER IF EXISTS dbo.trg_EvaluacionPrioridad_ActualizaParticipacion;

GO

CREATE
TRIGGER dbo.trg_EvaluacionPrioridad_ActualizaParticipacion ON dbo.EvaluacionPrioridad AFTER
INSERT
    AS BEGIN
UPDATE lc
SET
    lc.idNivelInteres = i.idNivelInteres,
    lc.idPrioridadActual = i.idPrioridadAsignada
FROM
    dbo.LeadCaso lc
    JOIN inserted i ON i.idLeadCaso = lc.idLeadCaso;

UPDATE lc
SET
    lc.idEstadoParticipacion = 2,
    lc.idMotivoSuspension = 1
FROM
    dbo.LeadCaso lc
    JOIN inserted i ON i.idLeadCaso = lc.idLeadCaso
WHERE
    i.idPrioridadAsignada = 5
    AND lc.idEstadoParticipacion = 1;

END;

GO

DROP
TRIGGER IF EXISTS dbo.trg_EventoCaso_SoloInsercion;

GO

CREATE
TRIGGER dbo.trg_EventoCaso_SoloInsercion ON dbo.EventoCaso INSTEAD OF
UPDATE,
DELETE AS BEGIN RAISERROR (
    N'Los eventos no se modifican ni se eliminan: registre un evento de corrección.',
    16,
    1
);

END;

GO

DROP
TRIGGER IF EXISTS dbo.trg_EventoCaso_ActualizaCasoYEtapa;

GO

CREATE
TRIGGER dbo.trg_EventoCaso_ActualizaCasoYEtapa ON dbo.EventoCaso AFTER
INSERT
    AS BEGIN
UPDATE c
SET
    c.idEstadoCaso = 2,
    c.fechaCierre = i.fechaEvento,
    c.idMotivoCierre = i.idMotivoCierre
FROM
    dbo.Caso c
    JOIN inserted i ON i.idCaso = c.idCaso
WHERE
    i.idTipoEvento = 3;

UPDATE c
SET
    c.idEstadoCaso = 1,
    c.fechaCierre = NULL,
    c.idMotivoCierre = NULL
FROM
    dbo.Caso c
    JOIN inserted i ON i.idCaso = c.idCaso
WHERE
    i.idTipoEvento = 4;

UPDATE b
SET
    b.idEtapa = i.idEtapaResultante
FROM
    dbo.Beneficiario b
    JOIN dbo.Caso c ON c.idBeneficiario = b.idBeneficiario
    JOIN inserted i ON i.idCaso = c.idCaso
WHERE
    i.idEtapaResultante IS NOT NULL;

END;

GO

IF OBJECT_ID('dbo.App_TelegramChat', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_TelegramChat (
    idContacto BIGINT PRIMARY KEY REFERENCES dbo.Contacto (idContacto),
    chatId NVARCHAR(30) NOT NULL UNIQUE,
    linkedAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

END;

GO

IF OBJECT_ID('dbo.App_TelegramLink', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_TelegramLink (
    codeHash CHAR(64) PRIMARY KEY,
    idContacto BIGINT NOT NULL REFERENCES dbo.Contacto (idContacto),
    expiresAt DATETIME2(0) NOT NULL,
    usedAt DATETIME2(0) NULL,
    consentimiento BIT NOT NULL DEFAULT 0
);

END;

GO

IF OBJECT_ID('dbo.App_TelegramInbox', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_TelegramInbox (
    updateId BIGINT PRIMARY KEY,
    chatId NVARCHAR(30) NOT NULL,
    payload NVARCHAR(MAX) NOT NULL,
    idMensaje BIGINT NULL REFERENCES dbo.Mensaje (idMensaje),
    receivedAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    processedAt DATETIME2(0) NULL,
    error NVARCHAR(500) NULL
);

END;

GO

IF OBJECT_ID('dbo.App_Dispatch', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_Dispatch (
    idMensaje BIGINT PRIMARY KEY REFERENCES dbo.Mensaje (idMensaje),
    state NVARCHAR(20) NOT NULL DEFAULT N'pending' CHECK (
        state IN ('pending', 'sending', 'sent', 'failed', 'unknown')
    ),
    externalId NVARCHAR(100) NULL,
    claimedAt DATETIME2(0) NULL,
    error NVARCHAR(500) NULL,
    markup NVARCHAR(MAX) NULL
);

END;

GO

IF OBJECT_ID('dbo.App_IntegrationCursor', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_IntegrationCursor (
    name NVARCHAR(50) PRIMARY KEY,
    position BIGINT NOT NULL
);

END;

GO

IF OBJECT_ID('dbo.App_ContactSelection', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_ContactSelection (
    idContacto BIGINT PRIMARY KEY REFERENCES dbo.Contacto (idContacto),
    idLeadCaso BIGINT NOT NULL REFERENCES dbo.LeadCaso (idLeadCaso)
);

END;

GO

IF OBJECT_ID('dbo.App_TrialLink', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_TrialLink (
    codeHash CHAR(64) PRIMARY KEY,
    idLeadCaso BIGINT NOT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
    expiresAt DATETIME2(0) NOT NULL,
    usedAt DATETIME2(0) NULL
);

END;

GO

IF OBJECT_ID('dbo.App_OperationEvidence', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_OperationEvidence (
    id BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idCaso BIGINT NOT NULL REFERENCES dbo.Caso (idCaso),
    operation NVARCHAR(60) NOT NULL,
    reference NVARCHAR(300) NOT NULL,
    idOperador INT NULL REFERENCES dbo.Operador (idOperador),
    createdAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

END;

GO

IF OBJECT_ID('dbo.App_ContractSnapshot', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_ContractSnapshot (
    idContratacion BIGINT PRIMARY KEY REFERENCES dbo.Contratacion (idContratacion),
    previousStage TINYINT NOT NULL REFERENCES dbo.Cat_EtapaBeneficiario (id)
);

END;

GO

IF OBJECT_ID('dbo.App_Scholarship', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_Scholarship (
    idCaso BIGINT PRIMARY KEY REFERENCES dbo.Caso (idCaso),
    idPlan TINYINT NOT NULL REFERENCES dbo.PlanComercial (idPlan),
    idOperador INT NOT NULL REFERENCES dbo.Operador (idOperador),
    reference NVARCHAR(300) NOT NULL,
    authorizedAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    endDate DATE NOT NULL,
    activatedAt DATETIME2(0) NULL
);

END;

GO

IF OBJECT_ID('dbo.App_AgentAnalysis', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_AgentAnalysis (
    idMensaje BIGINT PRIMARY KEY REFERENCES dbo.Mensaje (idMensaje),
    model NVARCHAR(100) NOT NULL,
    payload NVARCHAR(MAX) NOT NULL,
    createdAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

END;

GO

IF OBJECT_ID('dbo.App_PublicOffer', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_PublicOffer (
    idOferta BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idPropuesta BIGINT NOT NULL REFERENCES dbo.PropuestaComercial (idPropuesta),
    tokenHash CHAR(64) NOT NULL UNIQUE,
    expiresAt DATETIME2(0) NOT NULL,
    createdAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

END;

GO

IF OBJECT_ID('dbo.App_PublicInquiry', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_PublicInquiry (
    idSolicitud BIGINT IDENTITY(1, 1) PRIMARY KEY,
    nombre NVARCHAR(150) NOT NULL,
    correo NVARCHAR(254) NOT NULL,
    beneficiario NVARCHAR(150) NOT NULL,
    esEstudiante BIT NOT NULL,
    planSolicitado NVARCHAR(80) NOT NULL,
    autorizaCorreo BIT NOT NULL,
    createdAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    telefono NVARCHAR(20) NULL,
    idRolContacto TINYINT NULL REFERENCES dbo.Cat_RolContacto (id),
    idContacto BIGINT NULL REFERENCES dbo.Contacto (idContacto),
    idLeadCaso BIGINT NULL REFERENCES dbo.LeadCaso (idLeadCaso),
    estado NVARCHAR(30) NOT NULL DEFAULT N'Pendiente',
    requestKey NVARCHAR(64) NULL,
    idPlanTarifa BIGINT NULL,
    idSolicitudProvisional BIGINT NULL REFERENCES dbo.SolicitudProvisional (idSolicitud)
);

END;

GO

DROP
TRIGGER IF EXISTS dbo.trg_PublicInquiry_ClaveUnica;

GO

CREATE
TRIGGER dbo.trg_PublicInquiry_ClaveUnica ON dbo.App_PublicInquiry AFTER
INSERT
,
UPDATE AS BEGIN IF EXISTS (
    SELECT
        p.requestKey
    FROM
        dbo.App_PublicInquiry p
    WHERE
        p.requestKey IS NOT NULL
        AND p.requestKey IN (
            SELECT
                requestKey
            FROM
                inserted
        )
    GROUP BY
        p.requestKey
    HAVING
        COUNT(*) > 1
) BEGIN RAISERROR (N'Ya existe una solicitud con esa clave.', 16, 1);

ROLLBACK TRANSACTION;

END END;

GO

IF OBJECT_ID('dbo.App_Onboarding', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_Onboarding (
    idContacto BIGINT PRIMARY KEY REFERENCES dbo.Contacto (idContacto),
    payload NVARCHAR(MAX) NOT NULL,
    step NVARCHAR(30) NOT NULL,
    idSolicitud BIGINT NOT NULL REFERENCES dbo.SolicitudProvisional (idSolicitud)
);

END;

GO

IF OBJECT_ID('dbo.App_AgentFailures', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_AgentFailures (
    idContacto BIGINT PRIMARY KEY REFERENCES dbo.Contacto (idContacto),
    consecutiveFailures INT NOT NULL DEFAULT 0
);

END;

GO

IF OBJECT_ID('dbo.App_WhatsAppInbox', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_WhatsAppInbox (
    seq BIGINT IDENTITY(1, 1) NOT NULL UNIQUE,
    eventKey NVARCHAR(150) PRIMARY KEY,
    kind NVARCHAR(10) NOT NULL CHECK (kind IN ('message', 'status')),
    waId NVARCHAR(150) NOT NULL,
    payload NVARCHAR(MAX) NOT NULL,
    idMensaje BIGINT NULL REFERENCES dbo.Mensaje (idMensaje),
    receivedAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    processedAt DATETIME2(0) NULL,
    error NVARCHAR(500) NULL
);

END;

GO

IF COL_LENGTH('dbo.App_WhatsAppInbox', 'waId') < 300 BEGIN
ALTER TABLE dbo.App_WhatsAppInbox
ALTER COLUMN waId NVARCHAR(150) NOT NULL;

END;

GO

IF OBJECT_ID('dbo.App_WhatsAppContact', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_WhatsAppContact (
    phoneNumberId NVARCHAR(30) NOT NULL,
    userId NVARCHAR(150) NOT NULL,
    idContacto BIGINT NOT NULL REFERENCES dbo.Contacto (idContacto),
    lastSeenAt DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    PRIMARY KEY (phoneNumberId, userId)
);

END;

GO

IF OBJECT_ID('dbo.UsuarioPlataforma', 'U') IS NULL BEGIN
CREATE TABLE dbo.UsuarioPlataforma (
    idUsuario BIGINT IDENTITY(1, 1) PRIMARY KEY,
    idBeneficiario BIGINT NOT NULL UNIQUE REFERENCES dbo.Beneficiario (idBeneficiario),
    nombreUsuario NVARCHAR(80) NOT NULL UNIQUE,
    claveHash NVARCHAR(200) NOT NULL,
    requiereCambioClave BIT NOT NULL DEFAULT 1,
    activo BIT NOT NULL DEFAULT 1,
    fechaCreacion DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

END;

GO

IF OBJECT_ID('dbo.HabilitacionAcceso', 'U') IS NULL BEGIN
CREATE TABLE dbo.HabilitacionAcceso (
    idContratacion BIGINT PRIMARY KEY REFERENCES dbo.Contratacion (idContratacion),
    idUsuario BIGINT NOT NULL REFERENCES dbo.UsuarioPlataforma (idUsuario),
    idContactoEntrega BIGINT NOT NULL REFERENCES dbo.Contacto (idContacto),
    idCanalEntrega TINYINT NOT NULL REFERENCES dbo.Cat_CanalComunicacion (id),
    idMensajeCredenciales BIGINT NOT NULL UNIQUE REFERENCES dbo.Mensaje (idMensaje),
    mensajeCifrado NVARCHAR(MAX) NULL,
    fechaCreacion DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

END;

GO

IF OBJECT_ID('dbo.App_KnowledgeDocument', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_KnowledgeDocument (
    idDocumento INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    titulo NVARCHAR(150) NOT NULL,
    contenido NVARCHAR(MAX) NOT NULL,
    palabrasClave NVARCHAR(1000) NOT NULL DEFAULT N'',
    fuente NVARCHAR(300) NOT NULL DEFAULT N'',
    activo BIT NOT NULL DEFAULT 0,
    version INT NOT NULL DEFAULT 1,
    nombreArchivo NVARCHAR(255) NULL,
    tipoArchivo VARCHAR(10) NOT NULL,
    archivoOriginal VARBINARY(MAX) NULL,
    claveOrigen NVARCHAR(100) NULL,
    fechaCreacion DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME()),
    fechaActualizacion DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

END;

GO

IF OBJECT_ID('dbo.App_KnowledgeFragment', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_KnowledgeFragment (
    idDocumento INT NOT NULL REFERENCES dbo.App_KnowledgeDocument (idDocumento),
    numero INT NOT NULL,
    contenido NVARCHAR(1800) NOT NULL,
    PRIMARY KEY (idDocumento, numero)
);

END;

GO

IF OBJECT_ID('dbo.App_AgentPolicy', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_AgentPolicy (
    id TINYINT NOT NULL PRIMARY KEY CHECK (id = 1),
    configuracion NVARCHAR(MAX) NOT NULL CHECK (ISJSON(configuracion) = 1),
    version INT NOT NULL DEFAULT 1,
    fechaActualizacion DATETIME2(0) NOT NULL DEFAULT DATEADD(HOUR, -5, SYSUTCDATETIME())
);

END;

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.App_AgentPolicy
    WHERE
        id = 1
)
INSERT
    dbo.App_AgentPolicy (id, configuracion)
VALUES
    (
        1,
        N'{"profileQuestions":true,"optionalQuestions":true,"recommendAfterProfile":true,"proposalLinks":true,"trialLinks":true,"guardianInvitations":true,"useLeadData":false,"questionOrder":["career","availability","budget"]}'
    );

GO

IF OBJECT_ID('dbo.App_AdminUser', 'U') IS NULL BEGIN
CREATE TABLE dbo.App_AdminUser (
    id TINYINT NOT NULL PRIMARY KEY CHECK (id = 1),
    usuario NVARCHAR(50) NOT NULL UNIQUE CHECK (usuario = N'admin'),
    claveHash NVARCHAR(200) NOT NULL
);

END;

GO

IF NOT EXISTS (
    SELECT
        1
    FROM
        dbo.App_AdminUser
    WHERE
        id = 1
)
INSERT
    dbo.App_AdminUser (id, usuario, claveHash)
VALUES
    (
        1,
        N'admin',
        N'scrypt$131072$8$1$9OtFHBvhnrgPQ5s5UgiE5A$4iWxnLMbwt5hxzrMgWS4UV9dXtseO6zJpLoQIQkMUKM'
    );

GO

IF JSON_VALUE(
    (
        SELECT
            configuracion
        FROM
            dbo.App_AgentPolicy
        WHERE
            id = 1
    ),
    '$.useLeadData'
) IS NULL
UPDATE dbo.App_AgentPolicy
SET
    configuracion = JSON_MODIFY(configuracion, '$.useLeadData', CAST(0 AS BIT))
WHERE
    id = 1;
