import { query } from '../db.mjs';
import { insert } from '../shared/repository.mjs';
export async function getCase(db, id) {
  return (
    await query(
      db,
      `SELECT
  c.*,
  b.idEtapa
FROM
  dbo.Caso c
WITH
  (UPDLOCK, HOLDLOCK)
  JOIN dbo.Beneficiario b ON b.idBeneficiario = c.idBeneficiario
WHERE
  c.idCaso = @id`,
      { id },
    )
  ).recordset[0];
}
export async function getOtherCase(db, beneficiary, id) {
  return (
    await query(
      db,
      `SELECT
  idCaso
FROM
  dbo.Caso
WITH
  (UPDLOCK, HOLDLOCK)
WHERE
  idBeneficiario = @beneficiary
  AND idEstadoCaso = 1
  AND idCaso <> @id`,
      { beneficiary, id },
    )
  ).recordset[0];
}
export async function addEvent(db, data) {
  return insert(
    db,
    `INSERT
  dbo.EventoCaso (
    idCaso,
    idTipoEvento,
    idLeadCasoAtribuido,
    idPropuestaAceptada,
    idEtapaResultante,
    idEstadoCasoResultante,
    idMotivoCierre,
    idOperador
  )
VALUES
  (
    @caseId,
    @type,
    @participant,
    @proposal,
    @stage,
    @state,
    @reason,
    @operator
  )`,
    {
      participant: null,
      proposal: null,
      stage: null,
      state: null,
      reason: null,
      operator: null,
      ...data,
    },
  );
}
export async function saveEvidence(db, data) {
  return query(
    db,
    `INSERT
  dbo.App_OperationEvidence (idCaso, operation, reference, idOperador)
VALUES
  (@caseId, @operation, @reference, @operator)`,
    data,
  );
}
export async function finishParticipants(db, caseId, converted = null) {
  return query(
    db,
    `UPDATE dbo.LeadCaso
SET
  idEstadoParticipacion = CASE
    WHEN idLeadCaso = @converted THEN 4
    ELSE 3
  END,
  idMotivoSuspension = NULL
WHERE
  idCaso = @caseId`,
    { caseId, converted },
  );
}
export async function closeCase(db, data) {
  await addEvent(db, { ...data, type: 3, state: 2 });
  await finishParticipants(db, data.caseId, data.converted ?? null);
}
export async function reopenCase(db, caseId) {
  return addEvent(db, { caseId, type: 4, state: 1 });
}
export async function resumeParticipant(db, id) {
  return query(
    db,
    `UPDATE lc
SET
  idEstadoParticipacion = CASE
    WHEN EXISTS (
      SELECT
        1
      FROM
        dbo.AutorizacionContacto a
      WHERE
        a.idContacto = l.idContacto
        AND a.idEstadoAutorizacion = 1
    ) THEN 1
    ELSE 2
  END,
  idMotivoSuspension = CASE
    WHEN EXISTS (
      SELECT
        1
      FROM
        dbo.AutorizacionContacto a
      WHERE
        a.idContacto = l.idContacto
        AND a.idEstadoAutorizacion = 1
    ) THEN NULL
    ELSE 2
  END
FROM
  dbo.LeadCaso lc
  JOIN dbo.Lead l ON l.idLead = lc.idLead
WHERE
  lc.idLeadCaso = @id`,
    { id },
  );
}
export async function createCase(db, beneficiary) {
  const id = await insert(
    db,
    `INSERT
  dbo.Caso (idBeneficiario)
VALUES
  (@beneficiary)`,
    { beneficiary },
  );
  await addEvent(db, { caseId: id, type: 2 });
  return id;
}
export async function addParticipant(db, lead, caseId, role) {
  return insert(
    db,
    `INSERT
  dbo.LeadCaso (idLead, idCaso, idRolContacto)
VALUES
  (@lead, @caseId, @role)`,
    { lead, caseId, role },
  );
}
export async function findParticipation(db, caseId, contact) {
  return (
    await query(
      db,
      `SELECT
  lc.idLeadCaso id
FROM
  dbo.LeadCaso lc
  JOIN dbo.Lead l ON l.idLead = lc.idLead
WHERE
  lc.idCaso = @caseId
  AND l.idContacto = @contact`,
      { caseId, contact },
    )
  ).recordset[0];
}
export async function hasWithdrawalAuthority(db, id) {
  return (
    (
      await query(
        db,
        `SELECT
  1 ok
FROM
  dbo.LeadCaso lc
WHERE
  lc.idLeadCaso = @id
  AND (
    (
      SELECT
        COUNT(*)
      FROM
        dbo.LeadCaso other
      WHERE
        other.idCaso = lc.idCaso
        AND other.idEstadoParticipacion = 1
    ) <= 1
    OR EXISTS (
      SELECT
        1
      FROM
        dbo.InvitacionVinculacion i
        JOIN dbo.AutorizacionVinculacion a ON a.idInvitacion = i.idInvitacion
      WHERE
        i.idLeadCasoResponsable = @id
        AND i.fechaVinculacion IS NOT NULL
        AND a.idEstadoAutorizacion = 1
    )
  )`,
        { id },
      )
    ).recordset.length > 0
  );
}
export async function getIncoming(db, id, caseId) {
  return (
    await query(
      db,
      `SELECT
  m.*
FROM
  dbo.Mensaje m
  JOIN dbo.LeadCaso lc ON lc.idLeadCaso = m.idLeadCaso
WHERE
  m.idMensaje = @id
  AND m.idDireccion = 1
  AND lc.idCaso = @caseId`,
      { id, caseId },
    )
  ).recordset[0];
}
export async function listCaseIds(db) {
  return (
    await query(
      db,
      `SELECT
  idCaso id
FROM
  dbo.Caso
WHERE
  idEstadoCaso = 1
ORDER BY
  idCaso`,
    )
  ).recordset;
}
export async function getInactivity(db, caseId) {
  return (
    await query(
      db,
      `DECLARE @responseDays INT = (
  SELECT
    valor
  FROM
    dbo.Param_Proceso
  WHERE
    codigo = N'PLAZO_RESPUESTA_TRAS_SEPTIMO_DIAS'
);

SELECT
  c.fechaApertura,
  (
    SELECT
      MAX(m.fechaHora)
    FROM
      dbo.Mensaje m
      JOIN dbo.LeadCaso lc ON lc.idLeadCaso = m.idLeadCaso
    WHERE
      lc.idCaso = c.idCaso
      AND m.idDireccion = 1
  ) lastIncoming,
  (
    SELECT
      MAX(e.fechaEvento)
    FROM
      dbo.EventoCaso e
    WHERE
      e.idCaso = c.idCaso
      AND e.idTipoEvento IN (2, 4, 5, 6, 7, 8)
  ) lastEvent,
  (
    SELECT
      MAX(m.fechaHora)
    FROM
      dbo.PropuestaComercial p
      JOIN dbo.Mensaje m ON m.idMensaje = p.idMensajeEntrega
    WHERE
      p.idCaso = c.idCaso
  ) lastProposal,
  (
    SELECT
      MAX(m.fechaHora)
    FROM
      dbo.PropuestaComercial p
      JOIN dbo.Mensaje m ON m.idMensaje = p.idMensajeRespuesta
    WHERE
      p.idCaso = c.idCaso
  ) lastAcceptance,
  (
    SELECT
      MAX(i.fechaVinculacion)
    FROM
      dbo.InvitacionVinculacion i
      JOIN dbo.NecesidadVinculacion n ON n.idNecesidad = i.idNecesidad
    WHERE
      n.idCaso = c.idCaso
  ) lastLink,
  (
    SELECT
      MAX(DATEADD(DAY, @responseDays, COALESCE(sent.fechaEntrega,i.fechaProgramada)))
    FROM
    dbo.IntentoContacto i
      JOIN dbo.LeadCaso lc ON lc.idLeadCaso = i.idLeadCaso
      LEFT JOIN dbo.Mensaje sent ON sent.idMensaje=i.idMensajeEnvio
    WHERE
      lc.idCaso = c.idCaso
  ) lastDeadline,
  CASE
    WHEN EXISTS (
      SELECT
        1
      FROM
        dbo.LeadCaso lc
        JOIN dbo.IntentoContacto i ON i.idLeadCaso = lc.idLeadCaso
      WHERE
        lc.idCaso = c.idCaso
        AND lc.idEstadoParticipacion = 1
        AND i.omitido = 0
        AND i.idMensajeEnvio IS NULL
    ) THEN 1
    ELSE 0
  END pendingAgenda,
  CASE
    WHEN EXISTS (
      SELECT
        1
      FROM
        dbo.Derivacion d
        JOIN dbo.Lead l ON l.idContacto = d.idContacto
        JOIN dbo.LeadCaso lc ON lc.idLead = l.idLead
      WHERE
        lc.idCaso = c.idCaso
        AND d.fechaAtencion IS NULL
    ) THEN 1
    ELSE 0
  END openHandoff,
  CASE
    WHEN EXISTS (
      SELECT
        1
      FROM
        dbo.Contratacion k
      WHERE
        k.idCaso = c.idCaso
        AND k.idEventoPago IS NOT NULL
        AND k.idEventoValidacion IS NULL
    ) THEN 1
    ELSE 0
  END pendingPayment,
  CASE
    WHEN EXISTS (
      SELECT
        1
      FROM
        dbo.App_Scholarship s
      WHERE
        s.idCaso = c.idCaso
        AND s.activatedAt IS NULL
    ) THEN 1
    ELSE 0
  END pendingScholarship
FROM
  dbo.Caso c
WHERE
  c.idCaso = @caseId`,
      { caseId },
    )
  ).recordset[0];
}
export async function startEligibility(db, id) {
  return query(
    db,
    `UPDATE dbo.LeadCaso
SET
  fechaInicioElegibilidad = COALESCE(
    fechaInicioElegibilidad,
    DATEADD(HOUR, -5, SYSUTCDATETIME())
  )
WHERE
  idLeadCaso = @id
  AND idEstadoParticipacion = 1`,
    { id },
  );
}
