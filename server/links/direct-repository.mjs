import { query } from '../db.mjs';
import { insert, now } from '../shared/repository.mjs';

export async function contactsByPhone(db, phone) {
  return (
    await query(
      db,
      'SELECT idContacto id, nombreCompleto name, correo email FROM dbo.Contacto WHERE telefono=@phone',
      { phone },
    )
  ).recordset;
}

export async function previousInvitationDelivery(db, contact, code) {
  return (
    await query(
      db,
      `SELECT TOP 1 m.idMensaje id, m.idCanal channel, m.idEstadoEntrega delivered, d.state
FROM dbo.Mensaje m WITH (UPDLOCK,HOLDLOCK)
JOIN dbo.App_Dispatch d ON d.idMensaje=m.idMensaje
WHERE m.idContacto=@contact AND JSON_VALUE(d.markup,'$.invitation.code')=@code
ORDER BY m.idMensaje DESC`,
      { contact, code },
    )
  ).recordset[0];
}

export async function hasAuthorization(db, contact) {
  return (
    (
      await query(
        db,
        'SELECT TOP 1 1 ok FROM dbo.AutorizacionContacto WHERE idContacto=@contact AND idEstadoAutorizacion=1',
        { contact },
      )
    ).recordset.length > 0
  );
}

export async function createInvitationMessage(db, data) {
  return insert(
    db,
    `INSERT dbo.Mensaje (idContacto, idDireccion, idCanal, idOrigenMensaje, idAutorizacionAlEnvio,
  idMensajeRespondido, textoMensaje, idEstadoEntrega, fechaEntrega, esAutomatico)
VALUES (@contact, 2, @channel, 2, @authorization, @replyTo, @text, @state,
  CASE WHEN @state = 2 THEN ${now} END, 0)`,
    data,
  );
}

export async function saveInvitationDispatch(db, id, channel, receipt, invitation) {
  await query(
    db,
    'INSERT dbo.App_Dispatch(idMensaje,state,externalId,markup) VALUES(@id,@state,@externalId,@markup)',
    {
      id,
      state: channel === 2 ? 'sent' : 'pending',
      externalId: receipt?.messageId ?? null,
      markup: JSON.stringify({ invitation }),
    },
  );
}

export async function hasDeliveryAuthorization(db, message) {
  return (
    (
      await query(
        db,
        `SELECT 1 ok FROM dbo.AutorizacionContacto
WHERE idAutorizacion=@authorization AND idContacto=@contact AND idCanal=@channel AND idEstadoAutorizacion=1`,
        {
          authorization: message.idAutorizacionAlEnvio,
          contact: message.idContacto,
          channel: message.idCanal,
        },
      )
    ).recordset.length > 0
  );
}

export async function invitationDispatch(db, id) {
  return (
    await query(
      db,
      `SELECT d.markup, m.idEstadoEntrega FROM dbo.App_Dispatch d WITH (UPDLOCK,HOLDLOCK)
JOIN dbo.Mensaje m ON m.idMensaje=d.idMensaje WHERE d.idMensaje=@id`,
      { id },
    )
  ).recordset[0];
}

export async function saveDispatchMarkup(db, id, markup) {
  await query(db, 'UPDATE dbo.App_Dispatch SET markup=@markup WHERE idMensaje=@id', {
    id,
    markup: JSON.stringify(markup),
  });
}

export async function deliveredInvitee(db, code) {
  return (
    await query(
      db,
      `SELECT TOP 1 c.idContacto id, c.nombreCompleto name, c.correo email, c.telefono phone, m.idCanal channel
FROM dbo.Mensaje m JOIN dbo.Contacto c ON c.idContacto = m.idContacto
WHERE m.idDireccion = 2 AND m.idLeadCaso IS NULL AND m.idEstadoEntrega=2 AND m.textoMensaje LIKE @pattern
ORDER BY m.idMensaje DESC`,
      { pattern: `%/invitacion/${code}%` },
    )
  ).recordset[0];
}
