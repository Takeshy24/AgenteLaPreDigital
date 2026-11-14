import { pool, query } from '../db.mjs';
import { now } from '../shared/repository.mjs';
export async function getHealth() {
  try {
    const result = await query(
      await pool(),
      `SELECT
  DB_NAME() databaseName`,
    );
    return { status: 'ok', ...result.recordset[0] };
  } catch {
    throw new Error('No se pudo conectar a SQL Server.');
  }
}
export async function listBeneficiaries() {
  return (
    await query(
      await pool(),
      `SELECT
  idBeneficiario id,
  nombreCompleto name
FROM
  dbo.Beneficiario
ORDER BY
  nombreCompleto`,
    )
  ).recordset;
}
export async function getWorkspace() {
  const db = await pool();
  const [leads, tariffs, params, agenda, channels, roles] = await Promise.all([
    query(
      db,
      `SELECT
  lc.idLeadCaso id,
  lc.idCaso,
  lc.idLead,
  l.idContacto,
  l.idBeneficiario,
  c.nombreCompleto name,
  c.correo email,
  c.telefono phone,
  b.nombreCompleto beneficiary,
  rc.nombre [role],
  cc.nombre channel,
  p.nombre priority,
  ep.nombre status,
  ni.nombre interest,
  pb.universidadObjetivo university,
  pb.carreraDeseada career,
  pb.disponibilidadEstudio availability,
  pc.presupuestoMensual budget,
  pb.ultimoPuntaje score,
  (SELECT STRING_AGG(cd.curso, ', ') FROM dbo.BeneficiarioCursoDificil cd WHERE cd.idBeneficiario = l.idBeneficiario) courses,
  (SELECT TOP 1 pa.descripcion FROM dbo.BeneficiarioPostulacionAnterior pa WHERE pa.idBeneficiario = l.idBeneficiario ORDER BY pa.idPostulacion DESC) applications,
lc.idEstadoParticipacion,
lc.idPrioridadActual,
ca.idEstadoCaso,
lc.fechaInicioElegibilidad,
lc.fechaIncorporacion,
(
  SELECT
    COUNT(*)
  FROM
    dbo.AutorizacionContacto a
  WHERE
    a.idContacto = c.idContacto
    AND a.idEstadoAutorizacion = 1
) authorized
FROM
  dbo.LeadCaso lc
  JOIN dbo.Lead l ON l.idLead = lc.idLead
  JOIN dbo.Contacto c ON c.idContacto = l.idContacto
  JOIN dbo.Beneficiario b ON b.idBeneficiario = l.idBeneficiario
  JOIN dbo.Caso ca ON ca.idCaso = lc.idCaso
  JOIN dbo.Cat_RolContacto rc ON rc.id = lc.idRolContacto
  LEFT JOIN dbo.Cat_CanalCaptacion cc ON cc.id = l.idCanalCaptacion
  JOIN dbo.Cat_Prioridad p ON p.id = lc.idPrioridadActual
  JOIN dbo.Cat_EstadoParticipacion ep ON ep.id = lc.idEstadoParticipacion
  JOIN dbo.Cat_NivelInteres ni ON ni.id = lc.idNivelInteres
  LEFT JOIN dbo.PerfilBeneficiario pb ON pb.idBeneficiario = b.idBeneficiario
  LEFT JOIN dbo.PerfilContacto pc ON pc.idContacto = c.idContacto
ORDER BY
  lc.idLeadCaso DESC`,
    ),
    query(
      db,
      `SELECT
  t.*,
  p.nombre [plan],
  m.nombre modalidad
FROM
  dbo.PlanTarifa t
  JOIN dbo.PlanComercial p ON p.idPlan = t.idPlan
  JOIN dbo.Cat_Modalidad m ON m.id = t.idModalidad
WHERE
  t.vigenciaDesde <= CAST(${now} AS DATE)
  AND (
    t.vigenciaHasta IS NULL
    OR t.vigenciaHasta >= CAST(${now} AS DATE)
  )`,
    ),
    query(
      db,
      `SELECT
  *
FROM
  dbo.Param_Proceso`,
    ),
    query(
      db,
      `SELECT
  *
FROM
  dbo.Param_AgendaIntento
ORDER BY
  numeroIntento`,
    ),
    query(
      db,
      `SELECT
  *
FROM
  dbo.Cat_CanalCaptacion`,
    ),
    query(
      db,
      `SELECT
  *
FROM
  dbo.Cat_RolContacto`,
    ),
  ]);
  return {
    leads: leads.recordset,
    tariffs: tariffs.recordset,
    parameters: params.recordset,
    agenda: agenda.recordset,
    channels: channels.recordset,
    roles: roles.recordset,
  };
}
export async function getDetails(id) {
  const db = await pool();
  const out = {};
  for (const [key, text] of Object.entries({
    messages: `SELECT
  m.*,
  ch.nombre canal
FROM
  dbo.Mensaje m
  JOIN dbo.Cat_CanalComunicacion ch ON ch.id = m.idCanal
WHERE
  m.idLeadCaso = @id
ORDER BY
  m.fechaHora,
  m.idMensaje`,
    changes: `SELECT
  cp.*,
  f.nombre campo
FROM
  dbo.CambioPerfil cp
  JOIN dbo.Cat_CampoPerfil f ON f.id = cp.idCampoPerfil
WHERE
  cp.idLeadCaso = @id
ORDER BY
  cp.idCambio DESC`,
    evaluations: `SELECT
  e.*,
  p.nombre prioridad
FROM
  dbo.EvaluacionPrioridad e
  JOIN dbo.Cat_Prioridad p ON p.id = e.idPrioridadAsignada
WHERE
  e.idLeadCaso = @id
ORDER BY
  e.idEvaluacion DESC`,
    attempts: `SELECT
  i.*,
  ch.nombre canalEnvio,
  m.fechaHora fechaEnvio,
  m.idEstadoEntrega estadoEnvio,
  m.fechaEntrega fechaEntregaEnvio,
  d.error errorEnvio
FROM
  dbo.IntentoContacto i
  LEFT JOIN dbo.Mensaje m ON m.idMensaje = i.idMensajeEnvio
  LEFT JOIN dbo.App_Dispatch d ON d.idMensaje = m.idMensaje
  LEFT JOIN dbo.Cat_CanalComunicacion ch ON ch.id = m.idCanal
WHERE
  i.idLeadCaso = @id
ORDER BY
  i.numeroIntento`,
    proposals: `SELECT
  pr.*,
  p.nombre [plan],
  t.precio precioCatalogo,
  m.fechaEntrega,
  m.idEstadoEntrega,
  m.textoMensaje
FROM
  dbo.PropuestaComercial pr
  JOIN dbo.PlanTarifa t ON t.idPlanTarifa = pr.idPlanTarifa
  JOIN dbo.PlanComercial p ON p.idPlan = t.idPlan
  JOIN dbo.Mensaje m ON m.idMensaje = pr.idMensajeEntrega
WHERE
  pr.idCaso = (
    SELECT
      idCaso
    FROM
      dbo.LeadCaso
    WHERE
      idLeadCaso = @id
  )
ORDER BY
  pr.idPropuesta DESC`,
    events: `SELECT
  e.idEvento,
  e.fechaEvento,
  t.nombre
TYPE
FROM
  dbo.EventoCaso e
  JOIN dbo.Cat_TipoEvento t ON t.id = e.idTipoEvento
WHERE
  e.idCaso = (
    SELECT
      idCaso
    FROM
      dbo.LeadCaso
    WHERE
      idLeadCaso = @id
  )
ORDER BY
  e.idEvento DESC`,
    handoffs: `SELECT
  d.idDerivacion,
  d.fechaAtencion,
  d.fechaRetomaAgente
FROM
  dbo.Derivacion d
  JOIN dbo.Lead l ON l.idContacto = d.idContacto
  JOIN dbo.LeadCaso lc ON lc.idLead = l.idLead
WHERE
  lc.idLeadCaso = @id
ORDER BY
  d.idDerivacion DESC`,
    invitations: `SELECT
  i.idInvitacion,
  i.codigoEnlace,
  i.nombreInvitado,
  i.fechaVinculacion
FROM
  dbo.InvitacionVinculacion i
  JOIN dbo.NecesidadVinculacion n ON n.idNecesidad = i.idNecesidad
WHERE
  n.idCaso = (
    SELECT
      idCaso
    FROM
      dbo.LeadCaso
    WHERE
      idLeadCaso = @id
  )
ORDER BY
  i.idInvitacion DESC`,
    contracts: `SELECT
  k.*,
  CAST(CASE WHEN EXISTS (
    SELECT 1 FROM dbo.EventoCaso refund WHERE refund.idCaso = k.idCaso AND refund.idTipoEvento = 9
  ) THEN 1 ELSE 0 END AS bit) invalidated
FROM
  dbo.Contratacion k
WHERE
  k.idCaso = (
    SELECT
      idCaso
    FROM
      dbo.LeadCaso
    WHERE
      idLeadCaso = @id
  )`,
    access: `SELECT
  u.nombreUsuario username,
  ct.nombreCompleto contact,
  ch.nombre channel,
  a.idMensajeCredenciales messageId,
  m.fechaEntrega deliveredAt,
  d.error,
  CASE
    WHEN m.idEstadoEntrega = 2 THEN N'Entregado'
    WHEN d.state = N'unknown' THEN N'Entrega incierta'
    WHEN m.idEstadoEntrega = 3 THEN N'Fallido'
    WHEN d.state = N'sent' THEN N'Esperando confirmación'
    ELSE N'Pendiente'
  END delivery,
  CAST(CASE WHEN m.idEstadoEntrega = 3 AND d.state <> N'unknown' THEN 1 ELSE 0 END AS bit) retryAllowed
FROM dbo.HabilitacionAcceso a
  JOIN dbo.UsuarioPlataforma u ON u.idUsuario = a.idUsuario
  JOIN dbo.Contratacion k ON k.idContratacion = a.idContratacion
  JOIN dbo.Contacto ct ON ct.idContacto = a.idContactoEntrega
  JOIN dbo.Cat_CanalComunicacion ch ON ch.id = a.idCanalEntrega
  JOIN dbo.Mensaje m ON m.idMensaje = a.idMensajeCredenciales
  LEFT JOIN dbo.App_Dispatch d ON d.idMensaje = m.idMensaje
WHERE k.idCaso = (SELECT idCaso FROM dbo.LeadCaso WHERE idLeadCaso = @id)`,
    trials: `SELECT
  p.*
FROM
  dbo.PruebaGratuita p
  JOIN dbo.Lead l ON l.idBeneficiario = p.idBeneficiario
  JOIN dbo.LeadCaso lc ON lc.idLead = l.idLead
WHERE
  lc.idLeadCaso = @id`,
  }))
    out[key] = (await query(db, text, { id })).recordset;
  return out;
}
