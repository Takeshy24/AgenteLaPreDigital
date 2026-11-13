import { query } from '../db.mjs';
import { insert } from '../shared/repository.mjs';

export async function firstWelcomeAttempt(db, participation) {
  return (
    await query(
      db,
      `SELECT i.idIntento id, l.idContacto contact, l.idLead lead, c.nombreCompleto name, a.idAutorizacion authorizationId
FROM dbo.IntentoContacto i WITH (UPDLOCK,HOLDLOCK)
JOIN dbo.LeadCaso lc ON lc.idLeadCaso=i.idLeadCaso
JOIN dbo.Lead l ON l.idLead=lc.idLead
JOIN dbo.Contacto c ON c.idContacto=l.idContacto
JOIN dbo.AutorizacionContacto a ON a.idContacto=l.idContacto AND a.idCanal=1 AND a.idEstadoAutorizacion=1
WHERE i.idLeadCaso=@participation AND i.numeroIntento=1 AND i.idMensajeEnvio IS NULL AND i.omitido=0`,
      { participation },
    )
  ).recordset[0];
}

export async function queueWelcome(db, participation, attempt, text) {
  const message = await insert(
    db,
    `INSERT dbo.Mensaje
(idContacto,idLead,idLeadCaso,idDireccion,idCanal,idOrigenMensaje,idAutorizacionAlEnvio,textoMensaje,idEstadoEntrega,esAutomatico)
VALUES (@contact,@lead,@participation,2,1,1,@authorization,@text,1,0)`,
    {
      contact: attempt.contact,
      lead: attempt.lead,
      participation,
      authorization: attempt.authorizationId,
      text,
    },
  );
  await query(
    db,
    `INSERT dbo.App_Dispatch(idMensaje,state,markup) VALUES(@message,N'pending',@markup);
UPDATE dbo.IntentoContacto SET idMensajeEnvio=@message WHERE idIntento=@attempt AND idMensajeEnvio IS NULL`,
    {
      message,
      attempt: attempt.id,
      markup: JSON.stringify({
        welcome: { source: 'landing', name: attempt.name?.trim().split(/\s+/)[0] || 'Hola' },
      }),
    },
  );
  return message;
}
