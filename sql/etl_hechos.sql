-- Carga de hechos desde el OLTP (recarga completa). Las vistas aplican las reglas de las secciones
-- 3.3 y 3.4 del informe; cada hecho se borra y se vuelve a cargar dentro de una transacción, de modo
-- que un error no deja la tabla vacía. Ejecutar después de etl_dimensiones.sql.
USE LaPreDigital_DataMart;

GO

CREATE OR ALTER VIEW dbo.v_ContactoInicial AS
SELECT
    lc.idLeadCaso,
    l.idContacto,
    canal.idCanal,
    lc.idRolContacto,
    lc.fechaInicioElegibilidad,
    entrega.fechaPrimeraEntrega,
    MIN(respuesta.fechaHora) AS fechaPrimeraRespuesta
FROM
    LaPreDigital_OLTP.dbo.LeadCaso AS lc
    INNER JOIN LaPreDigital_OLTP.dbo.Lead AS l ON l.idLead = lc.idLead
    LEFT JOIN LaPreDigital_OLTP.dbo.IntentoContacto AS primero ON primero.idLeadCaso = lc.idLeadCaso
    AND primero.numeroIntento = (
        SELECT
            MIN(i.numeroIntento)
        FROM
            LaPreDigital_OLTP.dbo.IntentoContacto AS i
        WHERE
            i.idLeadCaso = lc.idLeadCaso
            AND i.idMensajeEnvio IS NOT NULL
    )
    LEFT JOIN LaPreDigital_OLTP.dbo.Mensaje AS canal ON canal.idMensaje = primero.idMensajeEnvio
    LEFT JOIN (
        SELECT
            i.idLeadCaso,
            MIN(m.fechaEntrega) AS fechaPrimeraEntrega
        FROM
            LaPreDigital_OLTP.dbo.IntentoContacto AS i
            INNER JOIN LaPreDigital_OLTP.dbo.Mensaje AS m ON m.idMensaje = i.idMensajeEnvio
        WHERE
            m.idEstadoEntrega = 2
        GROUP BY
            i.idLeadCaso
    ) AS entrega ON entrega.idLeadCaso = lc.idLeadCaso
    LEFT JOIN LaPreDigital_OLTP.dbo.Mensaje AS respuesta ON (
        respuesta.idLeadCaso = lc.idLeadCaso
        OR (
            respuesta.idLeadCaso IS NULL
            AND respuesta.idContacto = l.idContacto
        )
    )
    AND respuesta.idDireccion = 1
    AND respuesta.esAutomatico = 0
    AND respuesta.fechaHora > entrega.fechaPrimeraEntrega
    AND respuesta.fechaHora <= DATEADD(HOUR, 168, entrega.fechaPrimeraEntrega)
WHERE
    lc.fechaInicioElegibilidad IS NOT NULL
GROUP BY
    lc.idLeadCaso,
    l.idContacto,
    canal.idCanal,
    lc.idRolContacto,
    lc.fechaInicioElegibilidad,
    entrega.fechaPrimeraEntrega;

GO

CREATE OR ALTER VIEW dbo.v_DatosVinculacion AS
SELECT
    n.idCaso,
    CASE
        WHEN i.fechaVinculacion >= av.fechaOtorgamiento
        AND i.fechaVinculacion >= ac.fechaOtorgamiento THEN i.fechaVinculacion
        WHEN av.fechaOtorgamiento >= ac.fechaOtorgamiento THEN av.fechaOtorgamiento
        ELSE ac.fechaOtorgamiento
    END AS fechaLogro,
    av.fechaRevocacion AS fechaRevocacionVinculo,
    ac.fechaRevocacion AS fechaRevocacionContacto
FROM
    LaPreDigital_OLTP.dbo.NecesidadVinculacion AS n
    INNER JOIN LaPreDigital_OLTP.dbo.InvitacionVinculacion AS i ON i.idNecesidad = n.idNecesidad
    INNER JOIN LaPreDigital_OLTP.dbo.LeadCaso AS responsable ON responsable.idLeadCaso = i.idLeadCasoResponsable
    AND responsable.idCaso = n.idCaso
    INNER JOIN LaPreDigital_OLTP.dbo.Lead AS l ON l.idLead = responsable.idLead
    AND l.idContacto = i.idResponsable
    INNER JOIN LaPreDigital_OLTP.dbo.AutorizacionVinculacion AS av ON av.idInvitacion = i.idInvitacion
    AND av.idEstadoAutorizacion IN (1, 2)
    INNER JOIN LaPreDigital_OLTP.dbo.AutorizacionContacto AS ac ON ac.idContacto = i.idResponsable
    AND ac.idEstadoAutorizacion IN (1, 2)
    AND ac.idCanal IN (1, 2, 3)
WHERE
    i.fechaVinculacion IS NOT NULL;

GO

CREATE OR ALTER VIEW dbo.v_NecesidadesVinculacion AS
SELECT
    n.idNecesidad,
    n.idCaso,
    n.idLeadCasoDeclara,
    n.idMensajeEvidencia,
    n.fechaNecesidad,
    MIN(v.fechaLogro) AS fechaVinculacionLograda
FROM
    LaPreDigital_OLTP.dbo.NecesidadVinculacion AS n
    LEFT JOIN dbo.v_DatosVinculacion AS v ON v.idCaso = n.idCaso
    AND v.fechaLogro >= n.fechaNecesidad
    AND (
        v.fechaRevocacionVinculo IS NULL
        OR v.fechaRevocacionVinculo > v.fechaLogro
    )
    AND (
        v.fechaRevocacionContacto IS NULL
        OR v.fechaRevocacionContacto > v.fechaLogro
    )
GROUP BY
    n.idNecesidad,
    n.idCaso,
    n.idLeadCasoDeclara,
    n.idMensajeEvidencia,
    n.fechaNecesidad;

GO

CREATE OR ALTER VIEW dbo.v_NecesidadesNuevas AS
SELECT
    n.idNecesidad,
    n.idCaso,
    n.idLeadCasoDeclara,
    n.idMensajeEvidencia,
    n.fechaNecesidad,
    n.fechaVinculacionLograda
FROM
    dbo.v_NecesidadesVinculacion AS n
WHERE
    NOT EXISTS (
        SELECT
            1
        FROM
            dbo.v_NecesidadesVinculacion AS anterior
        WHERE
            anterior.idCaso = n.idCaso
            AND (
                anterior.fechaNecesidad < n.fechaNecesidad
                OR (
                    anterior.fechaNecesidad = n.fechaNecesidad
                    AND anterior.idNecesidad < n.idNecesidad
                )
            )
            AND (
                anterior.fechaVinculacionLograda IS NULL
                OR anterior.fechaVinculacionLograda > n.fechaNecesidad
            )
    );

GO

CREATE OR ALTER VIEW dbo.v_AceptacionesPropuesta AS
SELECT
    evidencia.idPropuesta,
    MIN(evidencia.fecha) AS fechaAceptacionExpresa
FROM
    (
        SELECT
            p.idPropuesta,
            respuesta.fechaHora AS fecha
        FROM
            LaPreDigital_OLTP.dbo.PropuestaComercial AS p
            INNER JOIN LaPreDigital_OLTP.dbo.Mensaje AS respuesta ON respuesta.idMensaje = p.idMensajeRespuesta
        WHERE
            p.idResultado = 1
            AND p.aceptacionExpresa = 1
            AND respuesta.idDireccion = 1
            AND respuesta.esAutomatico = 0
        UNION ALL
        SELECT
            p.idPropuesta,
            evento.fechaEvento
        FROM
            LaPreDigital_OLTP.dbo.PropuestaComercial AS p
            INNER JOIN LaPreDigital_OLTP.dbo.EventoCaso AS evento ON evento.idPropuestaAceptada = p.idPropuesta
            AND evento.idCaso = p.idCaso
        WHERE
            p.idResultado = 1
            AND p.aceptacionExpresa = 1
            AND evento.idTipoEvento = 5
            AND NOT EXISTS (
                SELECT
                    1
                FROM
                    LaPreDigital_OLTP.dbo.EventoCaso AS correccion
                WHERE
                    correccion.idEventoCorregido = evento.idEvento
            )
    ) AS evidencia
GROUP BY
    evidencia.idPropuesta;

GO

CREATE OR ALTER VIEW dbo.v_AltasValidas AS
SELECT
    e.idEvaluacion,
    e.fechaEvaluacion,
    e.idPrioridadAsignada,
    lc.idCaso,
    lc.idRolContacto,
    l.idContacto
FROM
    LaPreDigital_OLTP.dbo.EvaluacionPrioridad AS e
    INNER JOIN LaPreDigital_OLTP.dbo.LeadCaso AS lc ON lc.idLeadCaso = e.idLeadCaso
    INNER JOIN LaPreDigital_OLTP.dbo.Lead AS l ON l.idLead = lc.idLead
WHERE
    e.idPrioridadAsignada = 2
    AND NOT EXISTS (
        SELECT
            1
        FROM
            LaPreDigital_OLTP.dbo.EvaluacionPrioridad AS correccion
        WHERE
            correccion.idEvaluacionCorregida = e.idEvaluacion
    );

GO

CREATE OR ALTER VIEW dbo.v_PrimeraAltaCaso AS
SELECT
    a.idEvaluacion,
    a.fechaEvaluacion,
    a.idPrioridadAsignada,
    a.idCaso,
    a.idRolContacto,
    a.idContacto
FROM
    dbo.v_AltasValidas AS a
WHERE
    NOT EXISTS (
        SELECT
            1
        FROM
            dbo.v_AltasValidas AS anterior
        WHERE
            anterior.idCaso = a.idCaso
            AND (
                anterior.fechaEvaluacion < a.fechaEvaluacion
                OR (
                    anterior.fechaEvaluacion = a.fechaEvaluacion
                    AND anterior.idEvaluacion < a.idEvaluacion
                )
            )
    );

GO

CREATE OR ALTER VIEW dbo.v_ConversionPagada AS
SELECT
    a.idCaso,
    a.idEvaluacion,
    a.idContacto,
    a.idRolContacto,
    a.idPrioridadAsignada,
    a.fechaEvaluacion AS fechaPrimeraAlta,
    pago.fechaEvento AS fechaPagoConfirmado,
    validacion.fechaEvento AS fechaValidacionContractual,
    MIN(reembolso.fechaEvento) AS fechaReembolsoInvalidante,
    MIN(beca.fechaEvento) AS fechaBecaCompleta,
    c.importeConfirmado
FROM
    dbo.v_PrimeraAltaCaso AS a
    LEFT JOIN LaPreDigital_OLTP.dbo.Contratacion AS c ON c.idCaso = a.idCaso
    LEFT JOIN LaPreDigital_OLTP.dbo.EventoCaso AS pago ON pago.idEvento = c.idEventoPago
    AND pago.idCaso = a.idCaso
    AND pago.idTipoEvento = 6
    AND NOT EXISTS (
        SELECT
            1
        FROM
            LaPreDigital_OLTP.dbo.EventoCaso AS correccion
        WHERE
            correccion.idEventoCorregido = pago.idEvento
    )
    LEFT JOIN LaPreDigital_OLTP.dbo.EventoCaso AS validacion ON validacion.idEvento = c.idEventoValidacion
    AND validacion.idCaso = a.idCaso
    AND validacion.idTipoEvento = 7
    AND NOT EXISTS (
        SELECT
            1
        FROM
            LaPreDigital_OLTP.dbo.EventoCaso AS correccion
        WHERE
            correccion.idEventoCorregido = validacion.idEvento
    )
    LEFT JOIN LaPreDigital_OLTP.dbo.EventoCaso AS reembolso ON reembolso.idCaso = a.idCaso
    AND reembolso.idTipoEvento = 9
    AND reembolso.fechaEvento BETWEEN a.fechaEvaluacion AND DATEADD(HOUR, 168, a.fechaEvaluacion)
    AND NOT EXISTS (
        SELECT
            1
        FROM
            LaPreDigital_OLTP.dbo.EventoCaso AS correccion
        WHERE
            correccion.idEventoCorregido = reembolso.idEvento
    )
    LEFT JOIN LaPreDigital_OLTP.dbo.EventoCaso AS beca ON beca.idCaso = a.idCaso
    AND beca.idTipoEvento = 3
    AND beca.idMotivoCierre = 2
    AND beca.fechaEvento BETWEEN a.fechaEvaluacion AND DATEADD(HOUR, 168, a.fechaEvaluacion)
    AND NOT EXISTS (
        SELECT
            1
        FROM
            LaPreDigital_OLTP.dbo.EventoCaso AS correccion
        WHERE
            correccion.idEventoCorregido = beca.idEvento
    )
GROUP BY
    a.idCaso,
    a.idEvaluacion,
    a.idContacto,
    a.idRolContacto,
    a.idPrioridadAsignada,
    a.fechaEvaluacion,
    pago.fechaEvento,
    validacion.fechaEvento,
    c.importeConfirmado;

GO

CREATE OR ALTER VIEW dbo.v_PerfilAmpliado AS
SELECT
    p.idPregunta,
    p.idContacto,
    m.idCanal,
    lc.idRolContacto,
    m.fechaEntrega AS fechaPreguntaEntregada,
    MIN(c.fechaRespuesta) AS fechaDatoRegistrado
FROM
    LaPreDigital_OLTP.dbo.PreguntaPerfil AS p
    INNER JOIN LaPreDigital_OLTP.dbo.Mensaje AS m ON m.idMensaje = p.idMensajePregunta
    AND m.idEstadoEntrega = 2
    INNER JOIN LaPreDigital_OLTP.dbo.LeadCaso AS lc ON lc.idLeadCaso = p.idLeadCaso
    LEFT JOIN LaPreDigital_OLTP.dbo.CambioPerfil AS c ON c.idContactoInformante = p.idContacto
    AND c.idTipoCambio IN (1, 2)
    AND c.idOperadorCorrige IS NULL
    AND c.fechaRespuesta BETWEEN m.fechaEntrega AND DATEADD(HOUR, 168, m.fechaEntrega)
GROUP BY
    p.idPregunta,
    p.idContacto,
    m.idCanal,
    lc.idRolContacto,
    m.fechaEntrega;

GO

SET XACT_ABORT ON;

BEGIN TRANSACTION;

DELETE FROM LaPreDigital_DataMart.dbo.HechoContactoInicial;

INSERT INTO
    LaPreDigital_DataMart.dbo.HechoContactoInicial (
        KeyParticipacion,
        KeyTiempo,
        KeyContacto,
        KeyCanal,
        KeyRolContacto,
        KeyTiempoPrimeraEntrega,
        KeyTiempoPrimeraRespuesta,
        M1,
        M2,
        M3
    )
SELECT
    v.idLeadCaso,
    dt.KeyTiempo,
    dc.KeyContacto,
    dca.KeyCanal,
    dr.KeyRolContacto,
    de.KeyTiempo,
    dres.KeyTiempo,
    1,
    CASE
        WHEN v.fechaPrimeraEntrega BETWEEN v.fechaInicioElegibilidad AND DATEADD(HOUR, 168, v.fechaInicioElegibilidad) THEN 1
        ELSE 0
    END,
    CASE
        WHEN v.fechaPrimeraEntrega BETWEEN v.fechaInicioElegibilidad AND DATEADD(HOUR, 168, v.fechaInicioElegibilidad)
        AND v.fechaPrimeraRespuesta IS NOT NULL THEN 1
        ELSE 0
    END
FROM
    LaPreDigital_DataMart.dbo.v_ContactoInicial AS v
    INNER JOIN LaPreDigital_DataMart.dbo.DimTiempo AS dt ON dt.fechaHora = v.fechaInicioElegibilidad
    INNER JOIN LaPreDigital_DataMart.dbo.DimContacto AS dc ON dc.idContacto = v.idContacto
    INNER JOIN LaPreDigital_DataMart.dbo.DimRolContacto AS dr ON dr.idRolContacto = v.idRolContacto
    INNER JOIN LaPreDigital_DataMart.dbo.DimCanal AS dca ON dca.idCanal = COALESCE(v.idCanal, 0)
    LEFT JOIN LaPreDigital_DataMart.dbo.DimTiempo AS de ON de.fechaHora = v.fechaPrimeraEntrega
    LEFT JOIN LaPreDigital_DataMart.dbo.DimTiempo AS dres ON dres.fechaHora = v.fechaPrimeraRespuesta;

COMMIT TRANSACTION;

GO

SET XACT_ABORT ON;

BEGIN TRANSACTION;

DELETE FROM LaPreDigital_DataMart.dbo.HechoAmpliacionPerfil;

WITH
    preguntas AS (
        SELECT
            v.*,
            YEAR(v.fechaPreguntaEntregada) AS anio,
            MONTH(v.fechaPreguntaEntregada) AS mes,
            ROW_NUMBER() OVER (
                PARTITION BY
                    v.idContacto,
                    YEAR(v.fechaPreguntaEntregada),
                    MONTH(v.fechaPreguntaEntregada)
                ORDER BY
                    v.fechaPreguntaEntregada,
                    v.idPregunta
            ) AS orden,
            MIN(v.fechaDatoRegistrado) OVER (
                PARTITION BY
                    v.idContacto,
                    YEAR(v.fechaPreguntaEntregada),
                    MONTH(v.fechaPreguntaEntregada)
            ) AS fechaDatoMes
        FROM
            LaPreDigital_DataMart.dbo.v_PerfilAmpliado AS v
    )
INSERT INTO
    LaPreDigital_DataMart.dbo.HechoAmpliacionPerfil (
        KeyContacto,
        anio,
        mes,
        KeyPregunta,
        KeyTiempo,
        KeyCanal,
        KeyRolContacto,
        KeyTiempoDato,
        M4,
        M5
    )
SELECT
    dc.KeyContacto,
    q.anio,
    q.mes,
    q.idPregunta,
    dt.KeyTiempo,
    dca.KeyCanal,
    dr.KeyRolContacto,
    dd.KeyTiempo,
    1,
    CASE
        WHEN q.fechaDatoMes IS NOT NULL THEN 1
        ELSE 0
    END
FROM
    preguntas AS q
    INNER JOIN LaPreDigital_DataMart.dbo.DimTiempo AS dt ON dt.fechaHora = q.fechaPreguntaEntregada
    INNER JOIN LaPreDigital_DataMart.dbo.DimContacto AS dc ON dc.idContacto = q.idContacto
    INNER JOIN LaPreDigital_DataMart.dbo.DimCanal AS dca ON dca.idCanal = q.idCanal
    INNER JOIN LaPreDigital_DataMart.dbo.DimRolContacto AS dr ON dr.idRolContacto = q.idRolContacto
    LEFT JOIN LaPreDigital_DataMart.dbo.DimTiempo AS dd ON dd.fechaHora = q.fechaDatoMes
WHERE
    q.orden = 1;

COMMIT TRANSACTION;

GO

SET XACT_ABORT ON;

BEGIN TRANSACTION;

DELETE FROM LaPreDigital_DataMart.dbo.HechoVinculacionEconomica;

INSERT INTO
    LaPreDigital_DataMart.dbo.HechoVinculacionEconomica (
        KeyNecesidad,
        KeyCaso,
        anio,
        mes,
        KeyTiempo,
        KeyContacto,
        KeyCanal,
        KeyRolContacto,
        KeyTiempoVinculacion,
        M6,
        M7
    )
SELECT
    n.idNecesidad,
    n.idCaso,
    YEAR(n.fechaNecesidad),
    MONTH(n.fechaNecesidad),
    dt.KeyTiempo,
    dc.KeyContacto,
    dca.KeyCanal,
    dr.KeyRolContacto,
    dv.KeyTiempo,
    1,
    CASE
        WHEN n.fechaVinculacionLograda BETWEEN n.fechaNecesidad AND DATEADD(HOUR, 168, n.fechaNecesidad) THEN 1
        ELSE 0
    END
FROM
    LaPreDigital_DataMart.dbo.v_NecesidadesNuevas AS n
    INNER JOIN LaPreDigital_OLTP.dbo.LeadCaso AS lc ON lc.idLeadCaso = n.idLeadCasoDeclara
    INNER JOIN LaPreDigital_OLTP.dbo.Lead AS l ON l.idLead = lc.idLead
    INNER JOIN LaPreDigital_OLTP.dbo.Mensaje AS m ON m.idMensaje = n.idMensajeEvidencia
    INNER JOIN LaPreDigital_DataMart.dbo.DimTiempo AS dt ON dt.fechaHora = n.fechaNecesidad
    INNER JOIN LaPreDigital_DataMart.dbo.DimContacto AS dc ON dc.idContacto = l.idContacto
    INNER JOIN LaPreDigital_DataMart.dbo.DimCanal AS dca ON dca.idCanal = m.idCanal
    INNER JOIN LaPreDigital_DataMart.dbo.DimRolContacto AS dr ON dr.idRolContacto = lc.idRolContacto
    LEFT JOIN LaPreDigital_DataMart.dbo.DimTiempo AS dv ON dv.fechaHora = n.fechaVinculacionLograda
WHERE
    NOT EXISTS (
        SELECT
            1
        FROM
            LaPreDigital_DataMart.dbo.v_NecesidadesNuevas AS anterior
        WHERE
            anterior.idCaso = n.idCaso
            AND YEAR(anterior.fechaNecesidad) = YEAR(n.fechaNecesidad)
            AND MONTH(anterior.fechaNecesidad) = MONTH(n.fechaNecesidad)
            AND (
                anterior.fechaNecesidad < n.fechaNecesidad
                OR (
                    anterior.fechaNecesidad = n.fechaNecesidad
                    AND anterior.idNecesidad < n.idNecesidad
                )
            )
    );

COMMIT TRANSACTION;

GO

SET XACT_ABORT ON;

BEGIN TRANSACTION;

DELETE FROM LaPreDigital_DataMart.dbo.HechoPropuestaComercial;

INSERT INTO
    LaPreDigital_DataMart.dbo.HechoPropuestaComercial (
        KeyPropuesta,
        KeyCaso,
        KeyTiempo,
        KeyCanal,
        KeyPlan,
        KeyTiempoAceptacion,
        M8,
        M9
    )
SELECT
    p.idPropuesta,
    p.idCaso,
    dt.KeyTiempo,
    dca.KeyCanal,
    dp.KeyPlan,
    da.KeyTiempo,
    1,
    CASE
        WHEN a.fechaAceptacionExpresa BETWEEN m.fechaEntrega AND DATEADD(HOUR, 168, m.fechaEntrega) THEN 1
        ELSE 0
    END
FROM
    LaPreDigital_OLTP.dbo.PropuestaComercial AS p
    INNER JOIN LaPreDigital_OLTP.dbo.Mensaje AS m ON m.idMensaje = p.idMensajeEntrega
    AND m.idEstadoEntrega = 2
    INNER JOIN LaPreDigital_OLTP.dbo.PlanTarifa AS t ON t.idPlanTarifa = p.idPlanTarifa
    INNER JOIN LaPreDigital_DataMart.dbo.DimTiempo AS dt ON dt.fechaHora = m.fechaEntrega
    INNER JOIN LaPreDigital_DataMart.dbo.DimCanal AS dca ON dca.idCanal = m.idCanal
    INNER JOIN LaPreDigital_DataMart.dbo.DimPlan AS dp ON dp.idPlan = t.idPlan
    LEFT JOIN LaPreDigital_DataMart.dbo.v_AceptacionesPropuesta AS a ON a.idPropuesta = p.idPropuesta
    LEFT JOIN LaPreDigital_DataMart.dbo.DimTiempo AS da ON da.fechaHora = a.fechaAceptacionExpresa;

COMMIT TRANSACTION;

GO

SET XACT_ABORT ON;

BEGIN TRANSACTION;

DELETE FROM LaPreDigital_DataMart.dbo.HechoConversionPagada;

INSERT INTO
    LaPreDigital_DataMart.dbo.HechoConversionPagada (
        KeyCaso,
        KeyTiempo,
        KeyContacto,
        KeyRolContacto,
        KeyPrioridad,
        KeyTiempoPago,
        KeyTiempoValidacion,
        KeyTiempoReembolso,
        KeyTiempoBeca,
        M10,
        M11
    )
SELECT
    v.idCaso,
    dt.KeyTiempo,
    dc.KeyContacto,
    dr.KeyRolContacto,
    dp.KeyPrioridad,
    dpa.KeyTiempo,
    dva.KeyTiempo,
    dre.KeyTiempo,
    db.KeyTiempo,
    CASE
        WHEN v.fechaBecaCompleta IS NULL THEN 1
        ELSE 0
    END,
    CASE
        WHEN v.fechaBecaCompleta IS NULL
        AND v.fechaReembolsoInvalidante IS NULL
        AND v.importeConfirmado > 0
        AND v.fechaPagoConfirmado BETWEEN v.fechaPrimeraAlta AND DATEADD(HOUR, 168, v.fechaPrimeraAlta)
        AND v.fechaValidacionContractual BETWEEN v.fechaPrimeraAlta AND DATEADD(HOUR, 168, v.fechaPrimeraAlta) THEN 1
        ELSE 0
    END
FROM
    LaPreDigital_DataMart.dbo.v_ConversionPagada AS v
    INNER JOIN LaPreDigital_DataMart.dbo.DimTiempo AS dt ON dt.fechaHora = v.fechaPrimeraAlta
    INNER JOIN LaPreDigital_DataMart.dbo.DimContacto AS dc ON dc.idContacto = v.idContacto
    INNER JOIN LaPreDigital_DataMart.dbo.DimRolContacto AS dr ON dr.idRolContacto = v.idRolContacto
    INNER JOIN LaPreDigital_DataMart.dbo.DimPrioridad AS dp ON dp.idPrioridad = v.idPrioridadAsignada
    LEFT JOIN LaPreDigital_DataMart.dbo.DimTiempo AS dpa ON dpa.fechaHora = v.fechaPagoConfirmado
    LEFT JOIN LaPreDigital_DataMart.dbo.DimTiempo AS dva ON dva.fechaHora = v.fechaValidacionContractual
    LEFT JOIN LaPreDigital_DataMart.dbo.DimTiempo AS dre ON dre.fechaHora = v.fechaReembolsoInvalidante
    LEFT JOIN LaPreDigital_DataMart.dbo.DimTiempo AS db ON db.fechaHora = v.fechaBecaCompleta;

COMMIT TRANSACTION;
