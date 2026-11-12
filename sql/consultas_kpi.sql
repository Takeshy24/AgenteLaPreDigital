-- Los seis indicadores por mes desde el DataMart (informe 3.3 y 6.4). Cada indicador usa su unidad de
-- conteo: participación (L-1.1, L-1.2), contacto único por mes (L-2.1), caso por mes (L-3.1, L-4.1) y
-- caso único (L-5.1). Denominador cero = «No aplicable» (NULL).
USE LaPreDigital_DataMart;

GO

WITH
    contacto AS (
        SELECT
            t.anio,
            t.mes,
            SUM(h.M1) AS M1,
            SUM(h.M2) AS M2,
            SUM(h.M3) AS M3
        FROM
            dbo.HechoContactoInicial AS h
            INNER JOIN dbo.DimTiempo AS t ON t.KeyTiempo = h.KeyTiempo
        GROUP BY
            t.anio,
            t.mes
    ),
    perfil AS (
        SELECT
            anio,
            mes,
            SUM(M4) AS M4,
            SUM(M5) AS M5
        FROM
            dbo.HechoAmpliacionPerfil
        GROUP BY
            anio,
            mes
    ),
    vinculacion AS (
        SELECT
            anio,
            mes,
            SUM(M6) AS M6,
            SUM(M7) AS M7
        FROM
            dbo.HechoVinculacionEconomica
        GROUP BY
            anio,
            mes
    ),
    propuesta AS (
        SELECT
            t.anio,
            t.mes,
            COUNT(DISTINCT h.KeyCaso) AS M8,
            COUNT(
                DISTINCT CASE
                    WHEN h.M9 = 1 THEN h.KeyCaso
                END
            ) AS M9
        FROM
            dbo.HechoPropuestaComercial AS h
            INNER JOIN dbo.DimTiempo AS t ON t.KeyTiempo = h.KeyTiempo
        GROUP BY
            t.anio,
            t.mes
    ),
    conversion AS (
        SELECT
            t.anio,
            t.mes,
            SUM(h.M10) AS M10,
            SUM(h.M11) AS M11
        FROM
            dbo.HechoConversionPagada AS h
            INNER JOIN dbo.DimTiempo AS t ON t.KeyTiempo = h.KeyTiempo
        GROUP BY
            t.anio,
            t.mes
    ),
    periodos AS (
        SELECT
            anio,
            mes
        FROM
            contacto
        UNION
        SELECT
            anio,
            mes
        FROM
            perfil
        UNION
        SELECT
            anio,
            mes
        FROM
            vinculacion
        UNION
        SELECT
            anio,
            mes
        FROM
            propuesta
        UNION
        SELECT
            anio,
            mes
        FROM
            conversion
    )
SELECT
    p.anio,
    p.mes,
    c.M1,
    c.M2,
    c.M3,
    CAST(100.0 * c.M2 / NULLIF(c.M1, 0) AS DECIMAL(5, 1)) AS [L-1.1],
    CAST(100.0 * c.M3 / NULLIF(c.M2, 0) AS DECIMAL(5, 1)) AS [L-1.2],
    pe.M4,
    pe.M5,
    CAST(100.0 * pe.M5 / NULLIF(pe.M4, 0) AS DECIMAL(5, 1)) AS [L-2.1],
    v.M6,
    v.M7,
    CAST(100.0 * v.M7 / NULLIF(v.M6, 0) AS DECIMAL(5, 1)) AS [L-3.1],
    pr.M8,
    pr.M9,
    CAST(100.0 * pr.M9 / NULLIF(pr.M8, 0) AS DECIMAL(5, 1)) AS [L-4.1],
    co.M10,
    co.M11,
    CAST(100.0 * co.M11 / NULLIF(co.M10, 0) AS DECIMAL(5, 1)) AS [L-5.1]
FROM
    periodos AS p
    LEFT JOIN contacto AS c ON c.anio = p.anio
    AND c.mes = p.mes
    LEFT JOIN perfil AS pe ON pe.anio = p.anio
    AND pe.mes = p.mes
    LEFT JOIN vinculacion AS v ON v.anio = p.anio
    AND v.mes = p.mes
    LEFT JOIN propuesta AS pr ON pr.anio = p.anio
    AND pr.mes = p.mes
    LEFT JOIN conversion AS co ON co.anio = p.anio
    AND co.mes = p.mes
ORDER BY
    p.anio,
    p.mes;
