import { query } from '../db.mjs';
import { insert } from '../shared/repository.mjs';

export async function getTarget(db, caseId) {
  return (
    await query(
      db,
      `SELECT
  b.idBeneficiario,
  b.nombreCompleto beneficiary,
  lc.idLeadCaso,
  lc.idLead,
  c.idContacto,
  c.nombreCompleto contact,
  c.correo,
  c.telefono,
  tc.chatId,
  CASE WHEN reply.idCanal IN (1, 2, 3) THEN reply.idCanal ELSE delivery.idCanal END channel
FROM dbo.Contratacion k
  JOIN dbo.Caso ca ON ca.idCaso = k.idCaso
  JOIN dbo.Beneficiario b ON b.idBeneficiario = ca.idBeneficiario
  JOIN dbo.PropuestaComercial p ON p.idPropuesta = k.idPropuestaAceptada
  JOIN dbo.LeadCaso lc ON lc.idLeadCaso = p.idLeadCasoAcepta
  JOIN dbo.Lead l ON l.idLead = lc.idLead
  JOIN dbo.Contacto c ON c.idContacto = l.idContacto
  JOIN dbo.Mensaje delivery ON delivery.idMensaje = p.idMensajeEntrega
  LEFT JOIN dbo.Mensaje reply ON reply.idMensaje = p.idMensajeRespuesta
  LEFT JOIN dbo.App_TelegramChat tc ON tc.idContacto = c.idContacto
WHERE k.idCaso = @caseId`,
      { caseId },
    )
  ).recordset[0];
}

export async function getAuthorization(db, contact, channel) {
  return (
    await query(
      db,
      `SELECT TOP 1 idAutorizacion id
FROM dbo.AutorizacionContacto
WHERE idContacto = @contact AND idCanal = @channel AND idEstadoAutorizacion = 1
ORDER BY idAutorizacion DESC`,
      { contact, channel },
    )
  ).recordset[0]?.id;
}

export async function getUser(db, beneficiary) {
  return (
    await query(
      db,
      `SELECT * FROM dbo.UsuarioPlataforma WITH (UPDLOCK, HOLDLOCK)
WHERE idBeneficiario = @beneficiary`,
      { beneficiary },
    )
  ).recordset[0];
}

export async function createUser(db, beneficiary, username, passwordHash) {
  return insert(
    db,
    `INSERT dbo.UsuarioPlataforma (idBeneficiario, nombreUsuario, claveHash)
VALUES (@beneficiary, @username, @passwordHash)`,
    { beneficiary, username, passwordHash },
  );
}

export async function getAccess(db, contractId) {
  return (
    await query(
      db,
      `SELECT
  a.*,
  u.nombreUsuario username,
  m.idEstadoEntrega,
  d.state dispatchState
FROM dbo.HabilitacionAcceso a WITH (UPDLOCK, HOLDLOCK)
  JOIN dbo.UsuarioPlataforma u ON u.idUsuario = a.idUsuario
  JOIN dbo.Mensaje m ON m.idMensaje = a.idMensajeCredenciales
  LEFT JOIN dbo.App_Dispatch d ON d.idMensaje = m.idMensaje
WHERE a.idContratacion = @contractId`,
      { contractId },
    )
  ).recordset[0];
}

export async function insertMessage(db, target, authorization, operator) {
  return insert(
    db,
    `INSERT dbo.Mensaje (
  idContacto, idLead, idLeadCaso, idDireccion, idCanal, idOrigenMensaje,
  idAutorizacionAlEnvio, idOperador, textoMensaje, idEstadoEntrega
)
VALUES (
  @contact, @lead, @participant, 2, @channel, 3, @authorization, @operator,
  N'Credenciales de acceso: contenido confidencial reservado al destinatario.', 1
)`,
    {
      contact: target.idContacto,
      lead: target.idLead,
      participant: target.idLeadCaso,
      channel: target.channel,
      authorization,
      operator,
    },
  );
}

export async function insertAccess(db, params) {
  await query(
    db,
    `INSERT dbo.HabilitacionAcceso (
  idContratacion, idUsuario, idContactoEntrega, idCanalEntrega, idMensajeCredenciales, mensajeCifrado
)
VALUES (@contractId, @userId, @contact, @channel, @messageId, @payload)`,
    params,
  );
}

export async function getPayload(db, messageId) {
  return (
    await query(
      db,
      `SELECT idContratacion, mensajeCifrado
FROM dbo.HabilitacionAcceso WHERE idMensajeCredenciales = @messageId`,
      { messageId },
    )
  ).recordset[0];
}

export async function replaceDelivery(db, contractId, messageId) {
  await query(
    db,
    `UPDATE dbo.HabilitacionAcceso
SET idMensajeCredenciales = @messageId
WHERE idContratacion = @contractId`,
    { contractId, messageId },
  );
}
