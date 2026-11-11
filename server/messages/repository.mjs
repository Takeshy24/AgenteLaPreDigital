import { query } from '../db.mjs';
import { insert, now } from '../shared/repository.mjs';
export async function insertUnassigned(db, contact, text, channel = 3) {
  return insert(
    db,
    'INSERT dbo.Mensaje(idContacto,idDireccion,idCanal,textoMensaje) VALUES(@contact,1,@channel,@text)',
    { contact, text, channel },
  );
}
export async function listContactParticipants(db, contact) {
  return (
    await query(
      db,
      'SELECT lc.idLeadCaso id FROM dbo.LeadCaso lc JOIN dbo.Lead l ON l.idLead=lc.idLead JOIN dbo.Caso c ON c.idCaso=lc.idCaso WHERE l.idContacto=@contact AND c.idEstadoCaso=1 AND lc.idEstadoParticipacion IN(1,2)',
      { contact },
    )
  ).recordset;
}
export async function clearContactBlocks(db, contact, messageId) {
  return query(
    db,
    `UPDATE b SET fechaFin=${now},idMensajeFin=@messageId FROM dbo.BloqueoPromocional b WHERE b.fechaFin IS NULL AND EXISTS(SELECT 1 FROM dbo.Lead l WHERE l.idContacto=@contact AND l.idBeneficiario=b.idBeneficiario)`,
    { contact, messageId },
  );
}
export async function latestUnassigned(db, contact) {
  return (
    await query(
      db,
      "SELECT TOP 1 m.idMensaje id,m.textoMensaje text FROM dbo.Mensaje m JOIN dbo.App_TelegramInbox inbox ON inbox.idMensaje=m.idMensaje WHERE m.idContacto=@contact AND m.idLeadCaso IS NULL AND inbox.error=N'Beneficiario pendiente de identificar' ORDER BY m.idMensaje DESC",
      { contact },
    )
  ).recordset[0];
}
export async function assignMessage(db, messageId, participation) {
  return query(
    db,
    'UPDATE dbo.Mensaje SET idLeadCaso=@participant,idLead=@lead WHERE idMensaje=@messageId AND idContacto=@contact AND idLeadCaso IS NULL',
    {
      messageId,
      participant: participation.idLeadCaso,
      lead: participation.idLead,
      contact: participation.idContacto,
    },
  );
}
export async function insertIncoming(db, params = {}, options = {}) {
  return insert(
    db,
    `INSERT
  dbo.Mensaje (
    idContacto,
    idLead,
    idLeadCaso,
    idDireccion,
    idCanal,
    textoMensaje
  )
VALUES
  (@contact, @lead, @id, 1, @channel, @text)`,
    params,
  );
}
export async function resumeOnReply(db, params = {}, options = {}) {
  return query(
    db,
    `UPDATE dbo.BloqueoPromocional
SET
  fechaFin = ${now},
  idMensajeFin = @messageId
WHERE
  idBeneficiario = @b
  AND fechaFin IS NULL;

UPDATE lc
SET
  idEstadoParticipacion = CASE
    WHEN EXISTS (
      SELECT
        1
      FROM
        dbo.AutorizacionContacto a
      WHERE
        a.idContacto = @contact
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
        a.idContacto = @contact
        AND a.idEstadoAutorizacion = 1
    ) THEN NULL
    ELSE 2
  END
FROM
  dbo.LeadCaso lc
WHERE
  idLeadCaso = @id
  AND idEstadoParticipacion IN (1, 2)`,
    params,
  );
}

export async function getOutgoing(db, id) {
  return (
    await query(
      db,
      `SELECT
  m.*,
  lc.idCaso
FROM
  dbo.Mensaje m
WITH
  (UPDLOCK, HOLDLOCK)
  JOIN dbo.LeadCaso lc ON lc.idLeadCaso = m.idLeadCaso
WHERE
  m.idMensaje = @id
  AND m.idDireccion = 2`,
      { id },
    )
  ).recordset[0];
}

export async function ensureDispatch(db, id) {
  return query(
    db,
    `IF NOT EXISTS (
    SELECT 1 FROM dbo.App_Dispatch WHERE idMensaje = @id
  )
  INSERT dbo.App_Dispatch (idMensaje, state)
  VALUES (@id, N'pending')`,
    { id },
  );
}
