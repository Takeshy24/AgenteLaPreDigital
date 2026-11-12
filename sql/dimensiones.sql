CREATE DATABASE LaPreDigital_DataMart;

GO

USE LaPreDigital_DataMart;

GO

CREATE TABLE dbo.DimTiempo (
    idTiempo INT NOT NULL PRIMARY KEY,
    fecha DATE NOT NULL UNIQUE,
    anio SMALLINT NOT NULL,
    trimestre TINYINT NOT NULL,
    mes TINYINT NOT NULL,
    dia TINYINT NOT NULL
);

GO

CREATE TABLE dbo.DimContacto (
    idContacto BIGINT NOT NULL PRIMARY KEY,
    nombreCompleto NVARCHAR(150) NOT NULL
);

GO

CREATE TABLE dbo.DimCanal (
    idCanal TINYINT NOT NULL PRIMARY KEY,
    nombre NVARCHAR(50) NOT NULL
);

GO

CREATE TABLE dbo.DimRolContacto (
    idRolContacto TINYINT NOT NULL PRIMARY KEY,
    nombre NVARCHAR(50) NOT NULL
);

GO

CREATE TABLE dbo.DimPlan (
    idPlan TINYINT NOT NULL PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL
);

GO

CREATE TABLE dbo.DimPrioridad (
    idPrioridad TINYINT NOT NULL PRIMARY KEY,
    nombre NVARCHAR(50) NOT NULL
);
