import { query } from '../db.mjs';
import { insert, now } from '../shared/repository.mjs';

export async function createChatContact(db, chat) {
  const contact = await insert(
    db,
    'INSERT dbo.Contacto(usuarioTelegram,inicioBotTelegram) VALUES(@chat,1)',
    { chat },
  );
  await query(db, 'INSERT dbo.App_TelegramChat(idContacto,chatId) VALUES(@contact,@chat)', {
    contact,
    chat,
  });
  return contact;
}
export async function createPhoneContact(db, phone) {
  return insert(db, 'INSERT dbo.Contacto(telefono) VALUES(@phone)', { phone });
}
export async function saveKnownContact(db, contact, data) {
  await query(
    db,
    `UPDATE dbo.Contacto
SET nombreCompleto=COALESCE(@name,nombreCompleto), correo=COALESCE(@email,correo), telefono=COALESCE(@phone,telefono)
WHERE idContacto=@contact`,
    { contact, name: data.name ?? null, email: data.email ?? null, phone: data.phone ?? null },
  );
}
export async function createRequest(db, { contact, role = null, channel = 5, text }) {
  return insert(
    db,
    'INSERT dbo.SolicitudProvisional(idContacto,idRolContacto,idCanalCaptacion,textoSolicitud) VALUES(@contact,@role,@channel,@text)',
    { contact, role, channel, text },
  );
}
export async function getState(db, contact) {
  return (
    await query(
      db,
      'SELECT * FROM dbo.App_Onboarding WITH(UPDLOCK,HOLDLOCK) WHERE idContacto=@contact',
      { contact },
    )
  ).recordset[0];
}
export async function getRequestState(db, id) {
  return (
    await query(
      db,
      'SELECT * FROM dbo.App_Onboarding WITH(UPDLOCK,HOLDLOCK) WHERE idSolicitud=@id',
      { id },
    )
  ).recordset[0];
}
export async function saveState(db, contact, payload, step, provisional = null) {
  await query(
    db,
    `IF EXISTS(SELECT 1 FROM dbo.App_Onboarding WHERE idContacto=@contact)
    UPDATE dbo.App_Onboarding SET payload=@payload,step=@step,idSolicitud=COALESCE(@provisional,idSolicitud) WHERE idContacto=@contact;
    ELSE INSERT dbo.App_Onboarding(idContacto,payload,step,idSolicitud) VALUES(@contact,@payload,@step,@provisional)`,
    { contact, payload: JSON.stringify(payload), step, provisional },
  );
}
export async function saveContact(db, contact, data) {
  await query(
    db,
    'UPDATE dbo.Contacto SET nombreCompleto=@name,correo=@email,telefono=@phone WHERE idContacto=@contact',
    { ...data, contact },
  );
}
export async function recordReply(db, contact, incoming, text, channel = 3) {
  const id = await insert(
    db,
    'INSERT dbo.Mensaje(idContacto,idDireccion,idCanal,idOrigenMensaje,idMensajeRespondido,textoMensaje,idEstadoEntrega,esAutomatico) VALUES(@contact,2,@channel,2,@incoming,@text,1,0)',
    {
      contact,
      incoming,
      text,
      channel,
    },
  );
  await query(db, `INSERT dbo.App_Dispatch(idMensaje,state,claimedAt) VALUES(@id,@state,${now})`, {
    id,
    state: channel === 1 ? 'pending' : 'sending',
  });
  return id;
}
export async function markChatConsent(db, contact, channel = 3) {
  await query(
    db,
    'UPDATE dbo.AutorizacionContacto SET idOrigenAutorizacion=3,versionTexto=@version WHERE idContacto=@contact AND idCanal=@channel AND idEstadoAutorizacion=1',
    {
      contact,
      channel,
      version: channel === 1 ? 'whatsapp-captacion-v1' : 'telegram-captacion-v1',
    },
  );
}
export async function linkRequest(db, { id, contact, lead }) {
  await query(
    db,
    `UPDATE s SET idEstadoSolicitud=2,idBeneficiarioVinculado=l.idBeneficiario,fechaVinculacion=${now}
    FROM dbo.SolicitudProvisional s JOIN dbo.LeadCaso lc ON lc.idLeadCaso=@lead JOIN dbo.Lead l ON l.idLead=lc.idLead WHERE s.idSolicitud=@id;
    DELETE dbo.App_Onboarding WHERE idSolicitud=@id;
    UPDATE dbo.App_PublicInquiry SET idLeadCaso=@lead,estado=N'Vinculada' WHERE idContacto=@contact AND idLeadCaso IS NULL`,
    { id, contact, lead },
  );
}
export async function hasChat(db, contact) {
  return (
    (
      await query(db, 'SELECT 1 found FROM dbo.App_TelegramChat WHERE idContacto=@contact', {
        contact,
      })
    ).recordset.length > 0
  );
}
export async function mergeChat(db, contact, old) {
  await query(
    db,
    `UPDATE dbo.App_TelegramChat SET idContacto=@contact WHERE idContacto=@old;
    UPDATE dbo.Mensaje SET idContacto=@contact WHERE idContacto=@old AND idLead IS NULL;
    UPDATE dbo.SolicitudProvisional SET idContacto=@contact WHERE idContacto=@old;
    UPDATE dbo.App_PublicInquiry SET idContacto=@contact WHERE idContacto=@old;
    UPDATE dbo.Contacto SET inicioBotTelegram=CASE WHEN EXISTS(SELECT 1 FROM dbo.App_TelegramChat WHERE idContacto=@contact) THEN 1 ELSE inicioBotTelegram END,usuarioTelegram=COALESCE(usuarioTelegram,(SELECT usuarioTelegram FROM dbo.Contacto WHERE idContacto=@old)) WHERE idContacto=@contact;
    UPDATE dbo.App_WhatsAppContact SET idContacto=@contact WHERE idContacto=@old;`,
    { contact, old },
  );
}
