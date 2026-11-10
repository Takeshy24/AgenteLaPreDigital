import { query } from '../db.mjs';
export async function latestTelegramMessage(db, contact) {
  return (
    await query(
      db,
      'SELECT TOP 1 idMensaje,idLeadCaso FROM dbo.Mensaje WHERE idContacto=@contact AND idDireccion=1 AND idCanal=3 AND idLeadCaso IS NOT NULL ORDER BY idMensaje DESC',
      { contact },
    )
  ).recordset[0];
}
export async function expireRequests(db) {
  await query(
    db,
    `UPDATE s SET idEstadoSolicitud=3 FROM dbo.SolicitudProvisional s
    WHERE s.idEstadoSolicitud=1 AND COALESCE((SELECT MAX(m.fechaHora) FROM dbo.Mensaje m WHERE m.idContacto=s.idContacto AND m.idDireccion=1 AND m.esAutomatico=0),s.fechaSolicitud)<DATEADD(DAY,-30,DATEADD(HOUR,-5,SYSUTCDATETIME()));
    UPDATE o SET step=N'expired' FROM dbo.App_Onboarding o JOIN dbo.SolicitudProvisional s ON s.idSolicitud=o.idSolicitud WHERE s.idEstadoSolicitud=3;
    UPDATE p SET estado=N'Descartada' FROM dbo.App_PublicInquiry p JOIN dbo.SolicitudProvisional s ON s.idSolicitud=p.idSolicitudProvisional WHERE s.idEstadoSolicitud=3`,
  );
}
import { insert, now } from '../shared/repository.mjs';
export async function listDue(db) {
  return (
    await query(
      db,
      `SELECT
  i.idIntento id,
  i.idLeadCaso,
  i.fechaProgramada,
  lc.idEstadoParticipacion,
  lc.idPrioridadActual,
  lc.idNivelInteres,
  lc.idCaso,
  l.idContacto,
  l.idLead,
  l.idBeneficiario,
  c.idEstadoCaso,
  CASE
    WHEN EXISTS (
      SELECT
        1
      FROM
        dbo.Derivacion d
      WHERE
        d.idContacto = l.idContacto
        AND d.fechaAtencion IS NULL
        AND d.fechaRetomaAgente IS NULL
    ) THEN 1
    ELSE 0
  END handoff,
  CASE
    WHEN EXISTS (
      SELECT
        1
      FROM
        dbo.BloqueoPromocional b
      WHERE
        b.idBeneficiario = l.idBeneficiario
        AND b.fechaFin IS NULL
    ) THEN 1
    ELSE 0
  END blocked,
  CASE WHEN EXISTS(SELECT 1 FROM dbo.App_Scholarship s WHERE s.idCaso=lc.idCaso AND s.activatedAt IS NULL) THEN 1 ELSE 0 END scholarshipPending,
  n.fechaProgramada nextAttempt
FROM
  dbo.IntentoContacto i
WITH
  (UPDLOCK, HOLDLOCK)
  JOIN dbo.LeadCaso lc ON lc.idLeadCaso = i.idLeadCaso
  JOIN dbo.Lead l ON l.idLead = lc.idLead
  JOIN dbo.Caso c ON c.idCaso = lc.idCaso
  OUTER APPLY (
    SELECT
      TOP 1 j.fechaProgramada
    FROM
      dbo.IntentoContacto j
    WHERE
      j.idLeadCaso = i.idLeadCaso
      AND j.numeroIntento > i.numeroIntento
    ORDER BY
      j.numeroIntento
  ) n
WHERE
  i.idMensajeEnvio IS NULL
  AND i.omitido = 0
  AND i.fechaProgramada <= ${now}
ORDER BY
  i.fechaProgramada,
  i.idIntento`,
    )
  ).recordset;
}
export async function omitAttempt(db, id) {
  return query(
    db,
    `UPDATE dbo.IntentoContacto
SET
  omitido = 1
WHERE
  idIntento = @id
  AND idMensajeEnvio IS NULL`,
    { id },
  );
}
export async function listChannels(db, contact) {
  return (
    await query(
      db,
      `SELECT
  a.idAutorizacion,
  a.idCanal,
  c.correo,
  c.telefono,
  c.usuarioTelegram,
  c.inicioBotTelegram
FROM
  dbo.AutorizacionContacto a
  JOIN dbo.Contacto c ON c.idContacto = a.idContacto
WHERE
  a.idContacto = @contact
  AND a.idEstadoAutorizacion = 1
  AND (
    (
      a.idCanal = 1
      AND c.telefono IS NOT NULL
    )
    OR (
      a.idCanal = 2
      AND c.correo IS NOT NULL
    )
    OR (
      a.idCanal = 3
      AND c.inicioBotTelegram = 1
      AND EXISTS (
        SELECT
          1
        FROM
          dbo.App_TelegramChat t
        WHERE
          t.idContacto = c.idContacto
      )
    )
  )
ORDER BY
  a.fechaOtorgamiento,
  a.idAutorizacion`,
      { contact },
    )
  ).recordset;
}
export async function createAttemptMessage(db, attempt, authorization) {
  const messageId = await insert(
    db,
    `INSERT
  dbo.Mensaje (
    idContacto,
    idLead,
    idLeadCaso,
    idDireccion,
    idCanal,
    idOrigenMensaje,
    idAutorizacionAlEnvio,
    esAutomatico,
    textoMensaje,
    idEstadoEntrega
  )
VALUES
  (
    @contact,
    @lead,
    @participant,
    2,
    @channel,
    1,
    @authorization,
    1,
    N'Hola. ¿Qué información necesitas para continuar tu preparación para la UNT?',
    1
  )`,
    {
      contact: attempt.idContacto,
      lead: attempt.idLead,
      participant: attempt.idLeadCaso,
      channel: authorization.idCanal,
      authorization: authorization.idAutorizacion,
    },
  );
  await query(
    db,
    `UPDATE dbo.IntentoContacto
SET
  idMensajeEnvio = @messageId
WHERE
  idIntento = @id
  AND idMensajeEnvio IS NULL`,
    { messageId, id: attempt.id },
  );
  return messageId;
}
export async function listEvaluable(db) {
  return (
    await query(
      db,
      `SELECT
  lc.idLeadCaso id
FROM
  dbo.LeadCaso lc
  JOIN dbo.Caso c ON c.idCaso = lc.idCaso
  OUTER APPLY (
    SELECT
      TOP 1 e.fechaEvaluacion
    FROM
      dbo.EvaluacionPrioridad e
    WHERE
      e.idLeadCaso = lc.idLeadCaso
    ORDER BY
      e.fechaEvaluacion DESC,
      e.idEvaluacion DESC
  ) e
WHERE
  lc.idEstadoParticipacion = 1
  AND c.idEstadoCaso = 1
  AND lc.fechaInicioElegibilidad IS NOT NULL
  AND (
    lc.idPrioridadActual = 1
    OR (
      lc.idPrioridadActual <> 1
      AND (
        e.fechaEvaluacion IS NULL
        OR DATEADD(
          DAY,
          (
            SELECT
              valor
            FROM
              dbo.Param_Proceso
            WHERE
              codigo = N'REEVALUACION_DIAS'
          ),
          e.fechaEvaluacion
        ) <= ${now}
      )
    )
  )`,
    )
  ).recordset;
}
export async function listDeadlineParticipants(db) {
  return (
    await query(
      db,
      `SELECT DISTINCT
  lc.idLeadCaso id
FROM
  dbo.LeadCaso lc
  JOIN dbo.Caso c ON c.idCaso = lc.idCaso
  JOIN dbo.IntentoContacto i ON i.idLeadCaso = lc.idLeadCaso
  JOIN dbo.Mensaje m ON m.idMensaje = i.idMensajeEnvio
  OUTER APPLY (
    SELECT
      TOP 1 j.fechaProgramada
    FROM
      dbo.IntentoContacto j
    WHERE
      j.idLeadCaso = i.idLeadCaso
      AND j.numeroIntento > i.numeroIntento
    ORDER BY
      j.numeroIntento
  ) n
  OUTER APPLY (
    SELECT
      MAX(e.fechaEvaluacion) evaluated
    FROM
      dbo.EvaluacionPrioridad e
    WHERE
      e.idLeadCaso = lc.idLeadCaso
  ) e
WHERE
  lc.idEstadoParticipacion = 1
  AND c.idEstadoCaso = 1
  AND m.idEstadoEntrega = 2
  AND COALESCE(
    n.fechaProgramada,
    DATEADD(
      DAY,
      (
        SELECT
          valor
        FROM
          dbo.Param_Proceso
        WHERE
          codigo = N'PLAZO_RESPUESTA_TRAS_SEPTIMO_DIAS'
      ),
      m.fechaEntrega
    )
  ) <= ${now}
  AND (
    e.evaluated IS NULL
    OR e.evaluated < COALESCE(
      n.fechaProgramada,
      DATEADD(
        DAY,
        (
          SELECT
            valor
          FROM
            dbo.Param_Proceso
          WHERE
            codigo = N'PLAZO_RESPUESTA_TRAS_SEPTIMO_DIAS'
        ),
        m.fechaEntrega
      )
    )
  )`,
    )
  ).recordset;
}
export async function expireTrials(db) {
  return query(
    db,
    `UPDATE dbo.PruebaGratuita
SET
  idEstadoPrueba = 2
WHERE
  idEstadoPrueba = 1
  AND fechaFin <= ${now}`,
  );
}
