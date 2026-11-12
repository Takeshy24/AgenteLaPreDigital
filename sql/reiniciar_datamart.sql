-- Borra vistas, hechos y dimensiones del DataMart (en ese orden, por las claves foráneas).
-- Después: dimensiones.sql, hechos.sql, etl_dimensiones.sql y etl_hechos.sql.
USE LaPreDigital_DataMart;

GO

DROP VIEW IF EXISTS dbo.v_ConversionPagada;

DROP VIEW IF EXISTS dbo.v_PrimeraAltaCaso;

DROP VIEW IF EXISTS dbo.v_AltasValidas;

DROP VIEW IF EXISTS dbo.v_AceptacionesPropuesta;

DROP VIEW IF EXISTS dbo.v_NecesidadesNuevas;

DROP VIEW IF EXISTS dbo.v_NecesidadesVinculacion;

DROP VIEW IF EXISTS dbo.v_DatosVinculacion;

DROP VIEW IF EXISTS dbo.v_PerfilAmpliado;

DROP VIEW IF EXISTS dbo.v_ContactoInicial;

GO

DROP TABLE IF EXISTS dbo.HechoContactoInicial;

DROP TABLE IF EXISTS dbo.HechoAmpliacionPerfil;

DROP TABLE IF EXISTS dbo.HechoVinculacionEconomica;

DROP TABLE IF EXISTS dbo.HechoPropuestaComercial;

DROP TABLE IF EXISTS dbo.HechoConversionPagada;

GO

DROP TABLE IF EXISTS dbo.DimTiempo;

DROP TABLE IF EXISTS dbo.DimContacto;

DROP TABLE IF EXISTS dbo.DimCanal;

DROP TABLE IF EXISTS dbo.DimRolContacto;

DROP TABLE IF EXISTS dbo.DimPlan;

DROP TABLE IF EXISTS dbo.DimPrioridad;
