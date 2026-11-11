import { query } from '../db.mjs';

// Lecturas del OLTP para los indicadores. Solo SELECT: no modifican datos.
const rows = async (db, text) => (await query(db, text)).recordset;

export function listParticipations(db) {
  return rows(
    db,
    `SELECT
  lc.idLeadCaso id,
  l.idContacto contactId,
  c.nombreCompleto contactName,
  lc.idRolContacto role,
  lc.fechaInicioElegibilidad startAt
FROM
  dbo.LeadCaso lc
  JOIN dbo.Lead l ON l.idLead = lc.idLead
  JOIN dbo.Contacto c ON c.idContacto = l.idContacto
WHERE
  lc.fechaInicioElegibilidad IS NOT NULL`,
  );
}
export function listAttempts(db) {
  return rows(
    db,
    `SELECT
  i.idLeadCaso id,
  i.numeroIntento n,
  i.omitido omitted,
  m.idCanal channel,
  m.idEstadoEntrega state,
  m.fechaEntrega deliveredAt
FROM
  dbo.IntentoContacto i
  LEFT JOIN dbo.Mensaje m ON m.idMensaje = i.idMensajeEnvio`,
  );
}
export function listIncoming(db) {
  return rows(
    db,
    `SELECT
  idContacto contactId,
  idLeadCaso id,
  fechaHora at
FROM
  dbo.Mensaje
WHERE
  idDireccion = 1
  AND esAutomatico = 0`,
  );
}
export function listQuestions(db) {
  return rows(
    db,
    `SELECT
  p.idContacto contactId,
  c.nombreCompleto contactName,
  lc.idRolContacto role,
  m.idCanal channel,
  m.fechaEntrega deliveredAt
FROM
  dbo.PreguntaPerfil p
  JOIN dbo.Mensaje m ON m.idMensaje = p.idMensajePregunta
  AND m.idEstadoEntrega = 2
  JOIN dbo.LeadCaso lc ON lc.idLeadCaso = p.idLeadCaso
  JOIN dbo.Contacto c ON c.idContacto = p.idContacto`,
  );
}
export function listProfileChanges(db) {
  return rows(
    db,
    `SELECT
  idContactoInformante contactId,
  fechaRespuesta at,
  idTipoCambio type,
  idOperadorCorrige operator
FROM
  dbo.CambioPerfil`,
  );
}
export function listNeeds(db) {
  return rows(
    db,
    `SELECT
  n.idNecesidad id,
  n.idCaso caseId,
  n.fechaNecesidad at,
  lc.idRolContacto role,
  l.idContacto contactId,
  c.nombreCompleto contactName,
  m.idCanal channel
FROM
  dbo.NecesidadVinculacion n
  JOIN dbo.LeadCaso lc ON lc.idLeadCaso = n.idLeadCasoDeclara
  JOIN dbo.Lead l ON l.idLead = lc.idLead
  JOIN dbo.Contacto c ON c.idContacto = l.idContacto
  LEFT JOIN dbo.Mensaje m ON m.idMensaje = n.idMensajeEvidencia`,
  );
}
export function listInvitations(db) {
  return rows(
    db,
    `SELECT
  i.idNecesidad needId,
  i.fechaVinculacion linkedAt,
  (
    SELECT
      MIN(av.fechaOtorgamiento)
    FROM
      dbo.AutorizacionVinculacion av
    WHERE
      av.idInvitacion = i.idInvitacion
      AND av.idEstadoAutorizacion IN (1, 2)
  ) linkAuthAt,
  (
    SELECT
      MIN(ac.fechaOtorgamiento)
    FROM
      dbo.AutorizacionContacto ac
    WHERE
      ac.idContacto = i.idResponsable
      AND ac.idEstadoAutorizacion IN (1, 2)
  ) contactAuthAt
FROM
  dbo.InvitacionVinculacion i`,
  );
}
export function listProposals(db) {
  return rows(
    db,
    `SELECT
  p.idCaso caseId,
  pl.idPlan planId,
  md.idCanal channel,
  md.fechaEntrega deliveredAt,
  p.idResultado result,
  p.aceptacionExpresa accepted,
  COALESCE(
    mr.fechaHora,
    (
      SELECT
        MIN(e.fechaEvento)
      FROM
        dbo.EventoCaso e
      WHERE
        e.idPropuestaAceptada = p.idPropuesta
        AND e.idTipoEvento = 5
    )
  ) acceptedAt
FROM
  dbo.PropuestaComercial p
  JOIN dbo.Mensaje md ON md.idMensaje = p.idMensajeEntrega
  AND md.idEstadoEntrega = 2
  JOIN dbo.PlanTarifa t ON t.idPlanTarifa = p.idPlanTarifa
  JOIN dbo.PlanComercial pl ON pl.idPlan = t.idPlan
  LEFT JOIN dbo.Mensaje mr ON mr.idMensaje = p.idMensajeRespuesta`,
  );
}
export function listHighPriorities(db) {
  return rows(
    db,
    `SELECT
  e.idEvaluacion id,
  e.fechaEvaluacion at,
  lc.idCaso caseId,
  l.idContacto contactId,
  c.nombreCompleto contactName,
  lc.idRolContacto role
FROM
  dbo.EvaluacionPrioridad e
  JOIN dbo.LeadCaso lc ON lc.idLeadCaso = e.idLeadCaso
  JOIN dbo.Lead l ON l.idLead = lc.idLead
  JOIN dbo.Contacto c ON c.idContacto = l.idContacto
WHERE
  e.idPrioridadAsignada = 2
  AND NOT EXISTS (
    SELECT
      1
    FROM
      dbo.EvaluacionPrioridad x
    WHERE
      x.idEvaluacionCorregida = e.idEvaluacion
  )`,
  );
}
export function listCases(db) {
  return rows(
    db,
    `SELECT
  idCaso caseId,
  idMotivoCierre reason,
  fechaCierre closedAt
FROM
  dbo.Caso`,
  );
}
export function listContracts(db) {
  return rows(
    db,
    `SELECT
  ct.idCaso caseId,
  pago.fechaEvento paidAt,
  val.fechaEvento validatedAt,
  ct.importeConfirmado amount
FROM
  dbo.Contratacion ct
  LEFT JOIN dbo.EventoCaso pago ON pago.idEvento = ct.idEventoPago
  LEFT JOIN dbo.EventoCaso val ON val.idEvento = ct.idEventoValidacion`,
  );
}
export function listRefunds(db) {
  return rows(
    db,
    `SELECT
  e.idCaso caseId,
  e.fechaEvento at
FROM
  dbo.EventoCaso e
WHERE
  e.idTipoEvento = 9
  AND NOT EXISTS (
    SELECT
      1
    FROM
      dbo.EventoCaso x
    WHERE
      x.idEventoCorregido = e.idEvento
  )`,
  );
}
export function listPlans(db) {
  return rows(db, 'SELECT idPlan id, nombre name FROM dbo.PlanComercial ORDER BY idPlan');
}
export function listContacts(db) {
  return rows(
    db,
    'SELECT idContacto id, nombreCompleto name FROM dbo.Contacto ORDER BY nombreCompleto',
  );
}
