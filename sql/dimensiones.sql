-- DataMart de la fase LEADS (informe, secciones 4.2 y 6). Dimensiones D1 a D6.
-- Cada dimensión tiene una clave sustituta (Key…) y la clave de negocio del OLTP (id…), única.
IF DB_ID('LaPreDigital_DataMart') IS NULL EXEC ('CREATE DATABASE LaPreDigital_DataMart');

GO

USE LaPreDigital_DataMart;

GO

-- D1 Tiempo. Una fila por fecha y hora exacta (precisión de segundos, hora de Lima): las ventanas
-- de 168 horas se miden en horas exactas. Jerarquía Año → Trimestre → Mes → Día.
IF OBJECT_ID('dbo.DimTiempo', 'U') IS NULL
CREATE TABLE dbo.DimTiempo (
    KeyTiempo INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    fechaHora DATETIME2(0) NOT NULL UNIQUE,
    fecha DATE NOT NULL,
    anio SMALLINT NOT NULL,
    trimestre TINYINT NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
    mes TINYINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    dia TINYINT NOT NULL CHECK (dia BETWEEN 1 AND 31)
);

GO

-- D2 Contacto. Nivel único: contacto.
IF OBJECT_ID('dbo.DimContacto', 'U') IS NULL
CREATE TABLE dbo.DimContacto (
    KeyContacto INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    idContacto BIGINT NOT NULL UNIQUE,
    nombreCompleto NVARCHAR(150) NOT NULL
);

GO

-- D3 Canal. WhatsApp, correo y Telegram, más el miembro «Sin canal» (idCanal 0) para las
-- participaciones sin ningún intento enviado (tabla 10). «Portal web» no es un canal de contacto.
IF OBJECT_ID('dbo.DimCanal', 'U') IS NULL
CREATE TABLE dbo.DimCanal (
    KeyCanal INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    idCanal TINYINT NOT NULL UNIQUE,
    nombre NVARCHAR(50) NOT NULL
);

GO

-- D4 RolContacto. Estudiante, padre, madre o apoderado, según la participación del evento.
IF OBJECT_ID('dbo.DimRolContacto', 'U') IS NULL
CREATE TABLE dbo.DimRolContacto (
    KeyRolContacto INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    idRolContacto TINYINT NOT NULL UNIQUE,
    nombre NVARCHAR(50) NOT NULL
);

GO

-- D5 Plan. Ruta UNT, Meta UNT y Meta UNT Plus (Explora UNT no es una propuesta comercial).
IF OBJECT_ID('dbo.DimPlan', 'U') IS NULL
CREATE TABLE dbo.DimPlan (
    KeyPlan INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    idPlan TINYINT NOT NULL UNIQUE,
    nombre NVARCHAR(100) NOT NULL
);

GO

-- D6 Prioridad. Pendiente, Alta, Media, Baja y Nula.
IF OBJECT_ID('dbo.DimPrioridad', 'U') IS NULL
CREATE TABLE dbo.DimPrioridad (
    KeyPrioridad INT IDENTITY(1, 1) NOT NULL PRIMARY KEY,
    idPrioridad TINYINT NOT NULL UNIQUE,
    nombre NVARCHAR(50) NOT NULL
);
