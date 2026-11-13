SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @tablas TABLE (
    id INT IDENTITY(1,1),
    idObjeto INT,
    objeto NVARCHAR(300),
    conIdentity BIT
);

INSERT INTO @tablas (idObjeto, objeto, conIdentity)
SELECT t.object_id,
       QUOTENAME(s.name) + N'.' + QUOTENAME(t.name),
       CASE WHEN EXISTS (SELECT 1 FROM sys.identity_columns ic WHERE ic.object_id = t.object_id) THEN 1 ELSE 0 END
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE t.name NOT LIKE 'Cat[_]%'
  AND t.name NOT LIKE 'Param[_]%'
  AND t.name NOT IN ('PlanComercial', 'PlanTarifa', 'Operador', 'App_IntegrationCursor', 'App_DbWatchEvent', 'App_KnowledgeDocument', 'App_KnowledgeFragment', 'App_AgentPolicy', 'App_AdminUser');

IF '$(MODO)' = 'resumen'
BEGIN
    SELECT OBJECT_NAME(x.idObjeto) AS tabla, SUM(p.rows) AS filas
    FROM @tablas x
    JOIN sys.partitions p ON p.object_id = x.idObjeto AND p.index_id IN (0, 1)
    GROUP BY x.idObjeto
    HAVING SUM(p.rows) > 0
    ORDER BY SUM(p.rows) DESC;

    SELECT N'TOTAL' AS tabla, ISNULL(SUM(p.rows), 0) AS filas
    FROM @tablas x
    JOIN sys.partitions p ON p.object_id = x.idObjeto AND p.index_id IN (0, 1);
END;

IF '$(MODO)' = 'limpiar'
BEGIN
    DECLARE @i INT, @n INT = (SELECT COUNT(*) FROM @tablas), @sql NVARCHAR(MAX);

    BEGIN TRANSACTION;

    SET @i = 1;
    WHILE @i <= @n
    BEGIN
        SELECT @sql = N'ALTER TABLE ' + objeto + N' NOCHECK CONSTRAINT ALL' FROM @tablas WHERE id = @i;
        EXEC sys.sp_executesql @sql;
        SET @i += 1;
    END;

    DISABLE TRIGGER dbo.trg_EventoCaso_SoloInsercion ON dbo.EventoCaso;
    DISABLE TRIGGER dbo.trg_EvaluacionPrioridad_SoloInsercion ON dbo.EvaluacionPrioridad;

    SET @i = 1;
    WHILE @i <= @n
    BEGIN
        SELECT @sql = N'DELETE FROM ' + objeto FROM @tablas WHERE id = @i;
        EXEC sys.sp_executesql @sql;
        SET @i += 1;
    END;

    ENABLE TRIGGER dbo.trg_EventoCaso_SoloInsercion ON dbo.EventoCaso;
    ENABLE TRIGGER dbo.trg_EvaluacionPrioridad_SoloInsercion ON dbo.EvaluacionPrioridad;

    SET @i = 1;
    WHILE @i <= @n
    BEGIN
        SELECT @sql = N'ALTER TABLE ' + objeto + N' WITH CHECK CHECK CONSTRAINT ALL' FROM @tablas WHERE id = @i;
        EXEC sys.sp_executesql @sql;
        SET @i += 1;
    END;

    COMMIT TRANSACTION;

    SET @i = 1;
    WHILE @i <= @n
    BEGIN
        SELECT @sql = N'DBCC CHECKIDENT (''' + objeto + N''', RESEED, 0) WITH NO_INFOMSGS'
        FROM @tablas
        WHERE id = @i AND conIdentity = 1;
        IF @sql IS NOT NULL EXEC sys.sp_executesql @sql;
        SET @sql = NULL;
        SET @i += 1;
    END;
END;
