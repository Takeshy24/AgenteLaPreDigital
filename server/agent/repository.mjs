import { query } from '../db.mjs';
export async function getRequestedPlan(db, contact) {
  return (
    (
      await query(
        db,
        'SELECT TOP 1 p.planSolicitado plan,t.idPlanTarifa tariffId,modal.nombre period FROM dbo.App_PublicInquiry p LEFT JOIN dbo.PlanTarifa t ON t.idPlanTarifa=p.idPlanTarifa LEFT JOIN dbo.Cat_Modalidad modal ON modal.id=t.idModalidad WHERE p.idContacto=@contact ORDER BY p.idSolicitud DESC',
        { contact },
      )
    ).recordset[0] || null
  );
}
export async function getRecentHistory(db, id) {
  return (
    await query(
      db,
      'SELECT TOP 8 idDireccion direction,textoMensaje text FROM dbo.Mensaje WHERE idLeadCaso=@id ORDER BY idMensaje DESC',
      { id },
    )
  ).recordset.reverse();
}
export async function updateFailures(db, contact, failed) {
  return (
    await query(
      db,
      `IF NOT EXISTS(SELECT 1 FROM dbo.App_AgentFailures WITH(UPDLOCK,HOLDLOCK) WHERE idContacto=@contact) INSERT dbo.App_AgentFailures(idContacto) VALUES(@contact);
    UPDATE dbo.App_AgentFailures SET consecutiveFailures=CASE WHEN @failed=1 THEN consecutiveFailures+1 ELSE 0 END WHERE idContacto=@contact;
    SELECT consecutiveFailures n FROM dbo.App_AgentFailures WHERE idContacto=@contact`,
      { contact, failed },
    )
  ).recordset[0].n;
}
export async function findPendingProposal(db, caseId, id, tariff) {
  return (
    await query(
      db,
      `SELECT TOP 1 p.idPropuesta id,p.idMensajeEntrega messageId
    FROM dbo.PropuestaComercial p JOIN dbo.Mensaje m ON m.idMensaje=p.idMensajeEntrega
    WHERE p.idCaso=@caseId AND p.idLeadCasoEntrega=@id AND p.idPlanTarifa=@tariff
    AND p.idResultado IS NULL AND m.idEstadoEntrega IN(1,2)
    AND m.fechaHora>=DATEADD(DAY,-7,DATEADD(HOUR,-5,SYSUTCDATETIME())) ORDER BY p.idPropuesta DESC`,
      { caseId, id, tariff },
    )
  ).recordset[0];
}
export async function appendOfferLink(db, id, url) {
  await query(db, 'UPDATE dbo.Mensaje SET textoMensaje=textoMensaje+@suffix WHERE idMensaje=@id', {
    id,
    suffix: `\nRevisa y acepta la propuesta aquí: ${url}\nLa aceptación no confirma el pago.`,
  });
}
export async function recordQuestion(db, participant, message, field) {
  await query(
    db,
    'INSERT dbo.PreguntaPerfil(idLeadCaso,idContacto,idCampoPerfil,idMensajePregunta) VALUES(@id,@contact,@field,@message)',
    { id: participant.idLeadCaso, contact: participant.idContacto, field, message },
  );
}
