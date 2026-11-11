import { query } from '../db.mjs';
import { insert, now } from '../shared/repository.mjs';
export async function getUpdate(db, id) {
  return (
    await query(
      db,
      'SELECT * FROM dbo.App_TelegramInbox WITH(UPDLOCK,HOLDLOCK) WHERE updateId=@id',
      { id },
    )
  ).recordset[0];
}
export async function saveAnalysis(db, message, model, payload) {
  return query(
    db,
    'IF NOT EXISTS(SELECT 1 FROM dbo.App_AgentAnalysis WHERE idMensaje=@message) INSERT dbo.App_AgentAnalysis(idMensaje,model,payload) VALUES(@message,@model,@payload)',
    { message, model, payload: JSON.stringify(payload) },
  );
}
// consent = true cuando el enlace nace de un formulario donde la persona pidió Telegram: abrirlo
// y pulsar Iniciar completa la autorización de ese canal (ver handleStart).
export async function saveLink(db, contact, hash, consent = false) {
  await query(
    db,
    `DELETE dbo.App_TelegramLink
WHERE
  idContacto = @contact
  AND usedAt IS NULL;

INSERT
  dbo.App_TelegramLink (codeHash, idContacto, expiresAt, consentimiento)
VALUES
  (@hash, @contact, DATEADD(MINUTE, 10, ${now}), @consent)`,
    { contact, hash, consent },
  );
}
export async function linkHadConsent(db, hash) {
  return (
    (
      await query(db, 'SELECT consentimiento FROM dbo.App_TelegramLink WHERE codeHash = @hash', {
        hash,
      })
    ).recordset[0]?.consentimiento === true
  );
}
// Un chat que escribió /start sin código queda ligado a un contacto provisional, sin correo,
// teléfono ni LEADs. Un enlace válido, enviado al dueño del correo, lo reemplaza.
async function takeOverProvisionalChat(db, conflicts, chatId, contact) {
  if (conflicts.length !== 1 || conflicts[0].chatId !== chatId) return false;
  const provisional = (
    await query(
      db,
      `SELECT
  1 ok
FROM
  dbo.Contacto c
WHERE
  c.idContacto = @owner
  AND c.correo IS NULL
  AND c.telefono IS NULL
  AND c.nombreCompleto IS NULL
  AND NOT EXISTS (
    SELECT
      1
    FROM
      dbo.Lead l
    WHERE
      l.idContacto = c.idContacto
  )`,
      { owner: conflicts[0].idContacto },
    )
  ).recordset.length;
  if (!provisional) return false;
  await query(db, 'UPDATE dbo.App_TelegramChat SET idContacto = @contact WHERE chatId = @chatId', {
    contact,
    chatId,
  });
  return true;
}
export async function hasActiveLink(db, contact) {
  return (
    (
      await query(
        db,
        `SELECT
  1 ok
FROM
  dbo.App_TelegramLink
WHERE
  idContacto = @contact
  AND usedAt IS NULL
  AND expiresAt > ${now}`,
        { contact },
      )
    ).recordset.length > 0
  );
}
export async function useLink(db, hash, chatId) {
  const link = (
    await query(
      db,
      `SELECT
  *
FROM
  dbo.App_TelegramLink
WITH
  (UPDLOCK, HOLDLOCK)
WHERE
  codeHash = @hash
  AND usedAt IS NULL
  AND expiresAt > ${now}`,
      { hash },
    )
  ).recordset[0];
  if (!link) return null;
  const rows = (
    await query(
      db,
      `SELECT
  idContacto,
  chatId
FROM
  dbo.App_TelegramChat
WHERE
  chatId = @chatId
  OR idContacto = @contact`,
      { chatId, contact: link.idContacto },
    )
  ).recordset;
  const conflicts = rows.filter(
    (row) => !(row.chatId === chatId && Number(row.idContacto) === Number(link.idContacto)),
  );
  if (conflicts.length && !(await takeOverProvisionalChat(db, conflicts, chatId, link.idContacto)))
    return null;
  await query(
    db,
    `IF NOT EXISTS (
  SELECT
    1
  FROM
    dbo.App_TelegramChat
  WHERE
    idContacto = @contact
)
INSERT
  dbo.App_TelegramChat (idContacto, chatId)
VALUES
  (@contact, @chatId);

UPDATE dbo.Contacto
SET
  inicioBotTelegram = 1,
  usuarioTelegram = COALESCE(usuarioTelegram, @chatId)
WHERE
  idContacto = @contact;

UPDATE dbo.App_TelegramLink
SET
  usedAt = ${now}
WHERE
  codeHash = @hash`,
    { contact: link.idContacto, chatId, hash },
  );
  return link.idContacto;
}
export async function getChat(db, chatId) {
  return (
    await query(
      db,
      `SELECT
  *
FROM
  dbo.App_TelegramChat
WHERE
  chatId = @chatId`,
      { chatId },
    )
  ).recordset[0];
}
export async function listContactParticipations(db, contact) {
  return (
    await query(
      db,
      `SELECT
  lc.idLeadCaso id,
  lc.idCaso,
  c.idEstadoCaso,
  b.nombreCompleto beneficiary
FROM
  dbo.LeadCaso lc
  JOIN dbo.Lead l ON l.idLead = lc.idLead
  JOIN dbo.Caso c ON c.idCaso = lc.idCaso
  JOIN dbo.Beneficiario b ON b.idBeneficiario = l.idBeneficiario
WHERE
  l.idContacto = @contact
ORDER BY
  c.idEstadoCaso,
  lc.idLeadCaso DESC`,
      { contact },
    )
  ).recordset;
}
export async function saveSelection(db, contact, id) {
  await query(
    db,
    'IF EXISTS(SELECT 1 FROM dbo.App_ContactSelection WHERE idContacto=@contact) UPDATE dbo.App_ContactSelection SET idLeadCaso=@id WHERE idContacto=@contact; ELSE INSERT dbo.App_ContactSelection(idContacto,idLeadCaso) VALUES(@contact,@id)',
    { contact, id },
  );
}
export async function getSelection(db, contact) {
  return (
    await query(
      db,
      `SELECT
  idLeadCaso id
FROM
  dbo.App_ContactSelection
WHERE
  idContacto = @contact`,
      { contact },
    )
  ).recordset[0]?.id;
}
export async function acceptUpdate(db, update) {
  const chatId = String((update.message || update.callback_query?.message)?.chat.id);
  await query(
    db,
    `IF NOT EXISTS (
  SELECT
    1
  FROM
    dbo.App_TelegramInbox
  WITH
    (UPDLOCK, HOLDLOCK)
  WHERE
    updateId = @id
)
INSERT
  dbo.App_TelegramInbox (updateId, chatId, payload)
VALUES
  (@id, @chatId, @payload);

IF EXISTS (
  SELECT
    1
  FROM
    dbo.App_IntegrationCursor
  WHERE
    name = N'telegram'
)
UPDATE dbo.App_IntegrationCursor
SET
  position = CASE
    WHEN position < @id + 1 THEN @id + 1
    ELSE position
  END
WHERE
  name = N'telegram';

ELSE
INSERT
  dbo.App_IntegrationCursor (name, position)
VALUES
  (N'telegram', @id + 1)`,
    { id: update.update_id, chatId, payload: JSON.stringify(update) },
  );
}
export async function getCursor(db) {
  return (
    (
      await query(
        db,
        `SELECT
  position
FROM
  dbo.App_IntegrationCursor
WHERE
  name = N'telegram'`,
      )
    ).recordset[0]?.position || 0
  );
}
export async function pendingUpdates(db) {
  return (
    await query(
      db,
      `SELECT
  TOP 20 *
FROM
  dbo.App_TelegramInbox
WHERE
  processedAt IS NULL
ORDER BY
  updateId`,
    )
  ).recordset;
}
export async function finishUpdate(db, id, messageId = null, error = null) {
  await query(
    db,
    `UPDATE dbo.App_TelegramInbox
SET
  processedAt = ${now},
  idMensaje = @messageId,
  error = @error
WHERE
  updateId = @id`,
    { id, messageId, error },
  );
}
export async function createReply(db, participant, text, replyTo) {
  return insert(
    db,
    `INSERT
  dbo.Mensaje (
    idContacto,
    idLead,
    idLeadCaso,
    idDireccion,
    idCanal,
    idOrigenMensaje,
    idMensajeRespondido,
    textoMensaje,
    idEstadoEntrega,
    esAutomatico
  )
VALUES
  (
    @contact,
    @lead,
    @id,
    2,
    COALESCE(
      (
        SELECT
          idCanal
        FROM
          dbo.Mensaje
        WHERE
          idMensaje = @replyTo
          AND idCanal IN (1, 3)
      ),
      3
    ),
    2,
    @replyTo,
    @text,
    1,
    0
  )`,
    {
      contact: participant.idContacto,
      lead: participant.idLead,
      id: participant.idLeadCaso,
      replyTo,
      text,
    },
  );
}
export async function pendingMessages(db, channels = [3]) {
  const list =
    channels
      .map((channel) => Number(channel))
      .filter(Number.isInteger)
      .join(',') || '3';
  return (
    await query(
      db,
      `SELECT
  TOP 20 m.idMensaje id
FROM
  dbo.Mensaje m
  LEFT JOIN dbo.App_Dispatch d ON d.idMensaje = m.idMensaje
WHERE
  m.idDireccion = 2
  AND m.idCanal IN (${list})
  AND m.idEstadoEntrega = 1
  AND (
    d.idMensaje IS NULL
    OR d.state = N'pending'
  )
ORDER BY
  m.idMensaje`,
    )
  ).recordset;
}
export async function claimMessage(db, id) {
  const row = (
    await query(
      db,
      `SELECT
  m.*,
  tc.chatId,
  ct.telefono,
  lc.idEstadoParticipacion,
  c.idEstadoCaso,
  lc.idPrioridadActual,
  l.idBeneficiario
FROM
  dbo.Mensaje m
WITH
  (UPDLOCK, HOLDLOCK)
  JOIN dbo.LeadCaso lc ON lc.idLeadCaso = m.idLeadCaso
  JOIN dbo.Lead l ON l.idLead = lc.idLead
  JOIN dbo.Caso c ON c.idCaso = lc.idCaso
  LEFT JOIN dbo.App_TelegramChat tc ON tc.idContacto = m.idContacto
  JOIN dbo.Contacto ct ON ct.idContacto = m.idContacto
WHERE
  m.idMensaje = @id
  AND m.idEstadoEntrega = 1`,
      { id },
    )
  ).recordset[0];
  if (!row) return null;
  const prior = (
    await query(
      db,
      `SELECT
  *
FROM
  dbo.App_Dispatch
WITH
  (UPDLOCK, HOLDLOCK)
WHERE
  idMensaje = @id`,
      { id },
    )
  ).recordset[0];
  if (prior && prior.state !== 'pending') return null;
  await query(
    db,
    `IF NOT EXISTS (
  SELECT
    1
  FROM
    dbo.App_Dispatch
  WHERE
    idMensaje = @id
)
INSERT
  dbo.App_Dispatch (idMensaje, state, claimedAt)
VALUES
  (@id, N'sending', ${now});

ELSE
UPDATE dbo.App_Dispatch
SET
  state = N'sending',
  claimedAt = ${now}
WHERE
  idMensaje = @id`,
    { id },
  );
  row.markup = prior?.markup ?? null;
  return row;
}
export async function markSent(db, id, externalId) {
  await query(
    db,
    `UPDATE dbo.Mensaje
SET
  idEstadoEntrega = 2,
  fechaEntrega = ${now}
WHERE
  idMensaje = @id
  AND idEstadoEntrega = 1;

UPDATE dbo.App_Dispatch
SET
  state = N'sent',
  externalId = @externalId
WHERE
  idMensaje = @id`,
    { id, externalId: String(externalId) },
  );
}
export async function markFailed(db, id, error, uncertain = false) {
  await query(
    db,
    `UPDATE dbo.App_Dispatch
SET
  state = @state,
  error = @error
WHERE
  idMensaje = @id;

UPDATE dbo.Mensaje
SET
  idEstadoEntrega = CASE
    WHEN @uncertain = 1 THEN 1
    ELSE 3
  END
WHERE
  idMensaje = @id`,
    { id, state: uncertain ? 'unknown' : 'failed', error, uncertain },
  );
}
export async function hasConsent(db, contact, channel) {
  return (
    (
      await query(
        db,
        `SELECT
  1 ok
FROM
  dbo.AutorizacionContacto
WHERE
  idContacto = @contact
  AND idCanal = @channel
  AND idEstadoAutorizacion = 1`,
        { contact, channel },
      )
    ).recordset.length > 0
  );
}
export async function hasBlock(db, beneficiary) {
  return (
    (
      await query(
        db,
        `SELECT
  1 ok
FROM
  dbo.BloqueoPromocional
WHERE
  idBeneficiario = @beneficiary
  AND fechaFin IS NULL
UNION ALL SELECT 1 FROM dbo.App_Scholarship s JOIN dbo.Caso c ON c.idCaso=s.idCaso WHERE c.idBeneficiario=@beneficiary AND s.activatedAt IS NULL`,
        { beneficiary },
      )
    ).recordset.length > 0
  );
}
export async function recoverDispatches(db) {
  await query(
    db,
    `UPDATE dbo.App_Dispatch
SET
  state = N'unknown',
  error = N'Proceso interrumpido durante el envío; revisar antes de reintentar.'
WHERE
  state = N'sending'`,
  );
}

// WhatsApp: la API acepta el envío, pero solo se considera entregado cuando el estado lo confirma.
export async function markAccepted(db, id, externalId, usedTemplate = false) {
  await query(
    db,
    `UPDATE dbo.App_Dispatch
SET
  state = N'sent',
  externalId = @externalId
WHERE
  idMensaje = @id;

UPDATE dbo.Mensaje
SET
  usaPlantilla = @template
WHERE
  idMensaje = @id`,
    { id, externalId: String(externalId), template: usedTemplate ? 1 : 0 },
  );
}
export async function channelOf(db, id) {
  return (await query(db, 'SELECT idCanal channel FROM dbo.Mensaje WHERE idMensaje = @id', { id }))
    .recordset[0]?.channel;
}
export async function insideServiceWindow(db, contact) {
  return (
    (
      await query(
        db,
        `SELECT
  CASE
    WHEN MAX(fechaHora) >= DATEADD(HOUR, -24, ${now}) THEN 1
    ELSE 0
  END inside
FROM
  dbo.Mensaje
WHERE
  idContacto = @contact
  AND idDireccion = 1
  AND idCanal = 1`,
        { contact },
      )
    ).recordset[0]?.inside === 1
  );
}
export async function markDelivered(db, id) {
  await query(
    db,
    `UPDATE dbo.Mensaje
SET
  idEstadoEntrega = 2,
  fechaEntrega = ${now}
WHERE
  idMensaje = @id
  AND idEstadoEntrega = 1`,
    { id },
  );
}
export async function markRejected(db, id, error) {
  await query(
    db,
    `UPDATE dbo.Mensaje
SET
  idEstadoEntrega = 3
WHERE
  idMensaje = @id
  AND idEstadoEntrega = 1;

UPDATE dbo.App_Dispatch
SET
  state = N'failed',
  error = @error
WHERE
  idMensaje = @id`,
    { id, error: String(error).slice(0, 500) },
  );
}
export async function findDispatchByExternalId(db, externalId) {
  return (
    await query(db, 'SELECT idMensaje id FROM dbo.App_Dispatch WHERE externalId = @externalId', {
      externalId,
    })
  ).recordset[0]?.id;
}
export async function acceptWhatsAppEvent(db, event) {
  await query(
    db,
    `IF NOT EXISTS (
  SELECT
    1
  FROM
    dbo.App_WhatsAppInbox
  WITH
    (UPDLOCK, HOLDLOCK)
  WHERE
    eventKey = @key
)
INSERT
  dbo.App_WhatsAppInbox (eventKey, kind, waId, payload)
VALUES
  (@key, @kind, @waId, @payload)`,
    {
      key: event.key,
      kind: event.kind,
      waId: event.waId,
      payload: JSON.stringify(event.payload),
    },
  );
}
export async function pendingWhatsAppEvents(db) {
  return (
    await query(
      db,
      `SELECT
  TOP 20 *
FROM
  dbo.App_WhatsAppInbox
WHERE
  processedAt IS NULL
ORDER BY
  seq`,
    )
  ).recordset;
}
export async function getWhatsAppEvent(db, key) {
  return (await query(db, 'SELECT * FROM dbo.App_WhatsAppInbox WHERE eventKey = @key', { key }))
    .recordset[0];
}
export async function finishWhatsAppEvent(db, key, messageId = null, error = null) {
  await query(
    db,
    `UPDATE dbo.App_WhatsAppInbox
SET
  processedAt = ${now},
  idMensaje = @messageId,
  error = @error
WHERE
  eventKey = @key`,
    { key, messageId, error: error ? String(error).slice(0, 500) : null },
  );
}
export async function contactsByPhone(db, waId) {
  return (
    await query(db, 'SELECT idContacto id, correo FROM dbo.Contacto WHERE telefono = @phone', {
      phone: '+' + waId,
    })
  ).recordset;
}
export async function contactName(db, contact) {
  return (
    await query(db, 'SELECT nombreCompleto name FROM dbo.Contacto WHERE idContacto = @contact', {
      contact,
    })
  ).recordset[0]?.name;
}
export async function countIncoming(db, contact, channel) {
  return (
    await query(
      db,
      'SELECT COUNT(*) n FROM dbo.Mensaje WHERE idContacto = @contact AND idDireccion = 1 AND idCanal = @channel',
      { contact, channel },
    )
  ).recordset[0].n;
}

// messages: canal del mensaje sin asignar
