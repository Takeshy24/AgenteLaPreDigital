import { query } from '../db.mjs';
export async function getRequestedPlan(db, contact) {
  return (
    (
      await query(
        db,
        'SELECT TOP 1 p.planSolicitado [plan],t.idPlanTarifa tariffId,modal.nombre period FROM dbo.App_PublicInquiry p LEFT JOIN dbo.PlanTarifa t ON t.idPlanTarifa=p.idPlanTarifa LEFT JOIN dbo.Cat_Modalidad modal ON modal.id=t.idModalidad WHERE p.idContacto=@contact ORDER BY p.idSolicitud DESC',
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
export async function getProfile(db, participationId) {
  return (
    (
      await query(
        db,
        `SELECT pb.carreraDeseada career, pb.disponibilidadEstudio availability, pc.presupuestoMensual budget
    FROM dbo.LeadCaso lc JOIN dbo.Lead l ON l.idLead=lc.idLead
    LEFT JOIN dbo.PerfilBeneficiario pb ON pb.idBeneficiario=l.idBeneficiario
    LEFT JOIN dbo.PerfilContacto pc ON pc.idContacto=l.idContacto
    WHERE lc.idLeadCaso=@id`,
        { id: participationId },
      )
    ).recordset[0] || {}
  );
}
export async function attachMarkup(db, messageId, markup) {
  await query(
    db,
    `IF EXISTS(SELECT 1 FROM dbo.App_Dispatch WHERE idMensaje=@id) UPDATE dbo.App_Dispatch SET markup=@markup WHERE idMensaje=@id;
    ELSE INSERT dbo.App_Dispatch(idMensaje,state,markup) VALUES(@id,N'pending',@markup)`,
    { id: messageId, markup: JSON.stringify(markup) },
  );
}
export async function lastOutgoingMarkup(db, participationId) {
  const row = (
    await query(
      db,
      `SELECT TOP 1 d.markup
    FROM dbo.Mensaje m LEFT JOIN dbo.App_Dispatch d ON d.idMensaje=m.idMensaje
    WHERE m.idLeadCaso=@id AND m.idDireccion=2 ORDER BY m.idMensaje DESC`,
      { id: participationId },
    )
  ).recordset[0];
  return row?.markup ? JSON.parse(row.markup) : null;
}
export async function lastOutgoingText(db, participationId) {
  return (
    await query(
      db,
      'SELECT TOP 1 textoMensaje text FROM dbo.Mensaje WHERE idLeadCaso=@id AND idDireccion=2 ORDER BY idMensaje DESC',
      { id: participationId },
    )
  ).recordset[0]?.text;
}
