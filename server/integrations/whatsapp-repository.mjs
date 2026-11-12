import { query } from '../db.mjs';
import { now } from '../shared/repository.mjs';

export async function findWhatsAppContact(db, phoneNumberId, userId) {
  return (
    await query(
      db,
      `SELECT idContacto
FROM dbo.App_WhatsAppContact
WHERE phoneNumberId = @phoneNumberId AND userId = @userId`,
      { phoneNumberId, userId },
    )
  ).recordset[0]?.idContacto;
}

export async function saveWhatsAppContact(db, phoneNumberId, userId, contact) {
  const existing = (
    await query(
      db,
      `SELECT idContacto
FROM dbo.App_WhatsAppContact WITH (UPDLOCK, HOLDLOCK)
WHERE phoneNumberId = @phoneNumberId AND userId = @userId`,
      { phoneNumberId, userId },
    )
  ).recordset[0];
  if (existing && Number(existing.idContacto) !== Number(contact)) return false;
  await query(
    db,
    existing
      ? `UPDATE dbo.App_WhatsAppContact
SET lastSeenAt = ${now}
WHERE phoneNumberId = @phoneNumberId AND userId = @userId`
      : `INSERT dbo.App_WhatsAppContact (phoneNumberId, userId, idContacto)
VALUES (@phoneNumberId, @userId, @contact)`,
    { phoneNumberId, userId, contact },
  );
  return true;
}

export async function getWhatsAppRecipient(db, phoneNumberId, contact) {
  return (
    await query(
      db,
      `SELECT TOP 1 userId
FROM dbo.App_WhatsAppContact
WHERE phoneNumberId = @phoneNumberId AND idContacto = @contact
ORDER BY lastSeenAt DESC, userId`,
      { phoneNumberId, contact },
    )
  ).recordset[0]?.userId;
}
