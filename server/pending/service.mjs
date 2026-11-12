// Pendientes del personal comercial: todo lo que el sistema no puede resolver solo y espera a un
// operador (derivaciones de la sección 2.2, pagos por validar de F7, habilitaciones, becas, revisión
// de identidad, entregas fallidas y evaluaciones iniciales vencidas de la tabla 7).
import { pool, query } from '../db.mjs';

const participationOf = (contact) => `(SELECT TOP 1 lc.idLeadCaso FROM dbo.LeadCaso lc
  JOIN dbo.Lead l ON l.idLead=lc.idLead JOIN dbo.Caso k ON k.idCaso=lc.idCaso
  WHERE l.idContacto=${contact} AND k.idEstadoCaso=1 ORDER BY lc.idLeadCaso DESC)`;
const firstOfCase = (caseId) =>
  `(SELECT TOP 1 idLeadCaso FROM dbo.LeadCaso WHERE idCaso=${caseId} ORDER BY idLeadCaso)`;

const SOURCES = [
  {
    type: 'handoff',
    sql: `SELECT d.idDerivacion id, d.idMotivoDerivacion reason, m.nombre title, d.fechaInicio since,
      d.fechaRetomaAgente resumedAt, c.nombreCompleto person, msg.textoMensaje detail,
      ${participationOf('d.idContacto')} participationId
    FROM dbo.Derivacion d JOIN dbo.Cat_MotivoDerivacion m ON m.id=d.idMotivoDerivacion
    JOIN dbo.Contacto c ON c.idContacto=d.idContacto
    LEFT JOIN dbo.Mensaje msg ON msg.idMensaje=d.idMensajeOrigen
    WHERE d.fechaAtencion IS NULL`,
  },
  {
    type: 'payment',
    sql: `SELECT k.idCaso id, k.idCaso caseId, N'Pago por validar' title, e.fechaEvento since,
      b.nombreCompleto person, CONCAT(N'S/ ', k.importeConfirmado, N' · ', k.referenciaPago) detail,
      ${firstOfCase('k.idCaso')} participationId
    FROM dbo.Contratacion k JOIN dbo.Caso c ON c.idCaso=k.idCaso
    JOIN dbo.Beneficiario b ON b.idBeneficiario=c.idBeneficiario
    JOIN dbo.EventoCaso e ON e.idEvento=k.idEventoPago
    WHERE k.idEventoValidacion IS NULL AND c.idEstadoCaso=1`,
  },
  {
    type: 'activation',
    sql: `SELECT k.idCaso id, k.idCaso caseId, N'Habilitar el servicio' title, e.fechaEvento since,
      b.nombreCompleto person, N'Contratación validada sin habilitación' detail,
      ${firstOfCase('k.idCaso')} participationId
    FROM dbo.Contratacion k JOIN dbo.Caso c ON c.idCaso=k.idCaso
    JOIN dbo.Beneficiario b ON b.idBeneficiario=c.idBeneficiario
    JOIN dbo.EventoCaso e ON e.idEvento=k.idEventoValidacion
    WHERE k.fechaHabilitacion IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM dbo.EventoCaso refund
        WHERE refund.idCaso=k.idCaso AND refund.idTipoEvento=9
      )`,
  },
  {
    type: 'scholarship',
    sql: `SELECT s.idCaso id, s.idCaso caseId, N'Beca por habilitar' title, s.authorizedAt since,
      b.nombreCompleto person, s.reference detail, ${firstOfCase('s.idCaso')} participationId
    FROM dbo.App_Scholarship s JOIN dbo.Caso c ON c.idCaso=s.idCaso
    JOIN dbo.Beneficiario b ON b.idBeneficiario=c.idBeneficiario
    WHERE s.activatedAt IS NULL`,
  },
  {
    type: 'access-delivery',
    sql: `SELECT k.idCaso id, k.idCaso caseId, N'Credenciales pendientes de entrega' title,
      m.fechaHora since, b.nombreCompleto person,
      CONCAT(u.nombreUsuario, N' · ', ch.nombre, N' · ', ct.nombreCompleto, N' · ',
        CASE WHEN d.state=N'unknown' THEN N'Entrega incierta'
          WHEN m.idEstadoEntrega=3 THEN N'Fallido'
          WHEN d.state=N'sent' THEN N'Esperando confirmación'
          ELSE N'En cola' END) detail,
      m.idLeadCaso participationId,
      CAST(CASE WHEN m.idEstadoEntrega=3 AND d.state<>N'unknown' THEN 1 ELSE 0 END AS bit) retryAllowed
    FROM dbo.HabilitacionAcceso a
    JOIN dbo.UsuarioPlataforma u ON u.idUsuario=a.idUsuario
    JOIN dbo.Contratacion k ON k.idContratacion=a.idContratacion
    JOIN dbo.Caso c ON c.idCaso=k.idCaso
    JOIN dbo.Beneficiario b ON b.idBeneficiario=c.idBeneficiario
    JOIN dbo.Mensaje m ON m.idMensaje=a.idMensajeCredenciales
    JOIN dbo.Contacto ct ON ct.idContacto=a.idContactoEntrega
    JOIN dbo.Cat_CanalComunicacion ch ON ch.id=a.idCanalEntrega
    LEFT JOIN dbo.App_Dispatch d ON d.idMensaje=m.idMensaje
    WHERE m.idEstadoEntrega<>2`,
  },
  {
    type: 'identity',
    sql: `SELECT p.idSolicitud id, N'Revisar identidad' title, p.createdAt since, p.nombre person,
      p.correo email, p.beneficiario beneficiary,
      CONCAT(p.correo, N' · beneficiario: ', p.beneficiario) detail, NULL participationId
    FROM dbo.App_PublicInquiry p WHERE p.estado=N'Revisar identidad'`,
  },
  {
    type: 'delivery',
    sql: `SELECT p.idPropuesta id, N'Entrega de propuesta fallida' title, m.fechaHora since,
      c.nombreCompleto person, CONCAT(N'Propuesta #', p.idPropuesta) detail,
      p.idLeadCasoEntrega participationId
    FROM dbo.PropuestaComercial p JOIN dbo.Mensaje m ON m.idMensaje=p.idMensajeEntrega
    JOIN dbo.Contacto c ON c.idContacto=m.idContacto JOIN dbo.Caso k ON k.idCaso=p.idCaso
    WHERE m.idEstadoEntrega=3 AND p.idResultado IS NULL AND k.idEstadoCaso=1`,
  },
  {
    type: 'evaluation',
    sql: `SELECT lc.idLeadCaso id, N'Evaluación inicial vencida' title, lc.fechaInicioElegibilidad since,
      c.nombreCompleto person, N'Sigue Pendiente más de 24 horas' detail, lc.idLeadCaso participationId
    FROM dbo.LeadCaso lc JOIN dbo.Lead l ON l.idLead=lc.idLead
    JOIN dbo.Contacto c ON c.idContacto=l.idContacto JOIN dbo.Caso k ON k.idCaso=lc.idCaso
    WHERE lc.idPrioridadActual=1 AND lc.idEstadoParticipacion=1 AND k.idEstadoCaso=1
    AND lc.fechaInicioElegibilidad < DATEADD(HOUR,-29,SYSUTCDATETIME())`,
  },
];

// Qué debe hacer el operador con cada pendiente.
const ACTIONS = {
  handoff: (item) =>
    item.reason === 6
      ? 'Decide el descuento o la beca: prepara una propuesta con precio aprobado y marca la derivación como atendida.'
      : item.reason === 5
        ? 'Revisa el pago en la pasarela; el agente no puede confirmarlo.'
        : 'Atiende la conversación y marca la derivación como atendida.',
  payment: () => 'Revisa que el pago corresponda a la propuesta aceptada y valida la contratación.',
  activation: () => 'Registra la habilitación del servicio.',
  scholarship: () => 'Registra la habilitación de la beca.',
  identity: () => 'Confirma la identidad en LEADS y casos → Nuevo LEAD.',
  delivery: () => 'Reintenta el envío o documenta una entrega externa.',
  evaluation: () => 'Registra la primera evaluación de prioridad.',
  'access-delivery': () => 'Revisa la entrega de las credenciales en el canal de la contratación.',
};

export async function listPending() {
  const db = await pool();
  const items = [];
  for (const source of SOURCES)
    for (const row of (await query(db, source.sql, {})).recordset)
      items.push({ ...row, type: source.type, action: ACTIONS[source.type](row) });
  return items.sort((a, b) => new Date(a.since) - new Date(b.since));
}
