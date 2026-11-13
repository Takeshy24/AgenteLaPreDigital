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
        `SELECT pb.carreraDeseada career, pb.disponibilidadEstudio availability, pc.presupuestoMensual budget,
      lc.idRolContacto role, (SELECT nombreCompleto FROM dbo.Beneficiario WHERE idBeneficiario=l.idBeneficiario) beneficiary,
      (SELECT STRING_AGG(curso, ', ') FROM dbo.BeneficiarioCursoDificil WHERE idBeneficiario=l.idBeneficiario) courses,
      (SELECT TOP 1 descripcion FROM dbo.BeneficiarioPostulacionAnterior WHERE idBeneficiario=l.idBeneficiario ORDER BY idPostulacion DESC) applications,
      (SELECT STRING_AGG(CAST(idCampoPerfil AS varchar(3)), ',') FROM dbo.PreguntaPerfil WHERE idLeadCaso=lc.idLeadCaso) asked
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
export async function getCourseSelection(db, participationId) {
  const row = (
    await query(
      db,
      `SELECT TOP 1 m.idMensaje messageId, d.markup
       FROM dbo.Mensaje m INNER JOIN dbo.App_Dispatch d ON d.idMensaje=m.idMensaje
       WHERE m.idLeadCaso=@id AND m.idDireccion=2
         AND (JSON_QUERY(d.markup, '$.course_selection') IS NOT NULL
           OR JSON_VALUE(d.markup, '$.inline_keyboard[0][0].callback_data') LIKE @prefix)
       ORDER BY m.idMensaje DESC`,
      { id: participationId, prefix: `pf:${participationId}:d:%` },
    )
  ).recordset[0];
  if (!row) return null;
  const markup = JSON.parse(row.markup);
  return {
    messageId: row.messageId,
    markup,
    selected: [],
    completed: false,
    ...markup.course_selection,
  };
}

export async function completeCourseSelection(db, selection) {
  if (!selection || selection.completed) return;
  await attachMarkup(db, selection.messageId, {
    ...selection.markup,
    course_selection: { selected: selection.selected, completed: true },
  });
}
// Botones vigentes de la conversación: los del último mensaje del agente, sin contar la pregunta de
// autorización ni el aviso de derivación, que se envían aparte y tienen sus propios botones.
async function recentMarkups(db, participationId) {
  return (
    await query(
      db,
      `SELECT TOP 4 d.markup
    FROM dbo.Mensaje m LEFT JOIN dbo.App_Dispatch d ON d.idMensaje=m.idMensaje
    WHERE m.idLeadCaso=@id AND m.idDireccion=2 ORDER BY m.idMensaje DESC`,
      { id: participationId },
    )
  ).recordset.map((row) => (row.markup ? JSON.parse(row.markup) : null));
}
const aside = (markup) =>
  markup?.consent_prompt || markup?.consent_notice || markup?.handoff_notice;
export async function lastOutgoingMarkup(db, participationId) {
  return (await recentMarkups(db, participationId)).find((markup) => !aside(markup)) ?? null;
}
// Una opción elegida en una lista de WhatsApp trae su identificador: se busca en los mensajes recientes.
export async function findRecentButton(db, participationId, data) {
  for (const markup of await recentMarkups(db, participationId))
    if (
      !aside(markup) &&
      markup?.inline_keyboard?.flat().some((button) => button.callback_data === data)
    )
      return markup;
  return null;
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
// Última propuesta entregada a esta participación, sin respuesta y dentro del plazo de 7 días (F5).
export async function latestOpenProposal(db, id) {
  return (
    await query(
      db,
      `SELECT TOP 1 p.idPropuesta id
    FROM dbo.PropuestaComercial p JOIN dbo.Mensaje m ON m.idMensaje=p.idMensajeEntrega
    WHERE p.idLeadCasoEntrega=@id AND p.idResultado IS NULL AND m.idEstadoEntrega=2
    AND m.fechaEntrega>=DATEADD(DAY,-7,DATEADD(HOUR,-5,SYSUTCDATETIME())) ORDER BY p.idPropuesta DESC`,
      { id },
    )
  ).recordset[0];
}
// Objeción comercial declarada en un mensaje (tabla 3); una por mensaje.
export async function saveObjection(db, { id, type, text, messageId }) {
  await query(
    db,
    `IF NOT EXISTS(SELECT 1 FROM dbo.ObjecionComercial WHERE idMensajeEvidencia=@messageId)
    INSERT dbo.ObjecionComercial(idLeadCaso,idTipoObjecion,detalle,idMensajeEvidencia) VALUES(@id,@type,@text,@messageId)`,
    { id, type, text: String(text).slice(0, 500), messageId },
  );
}
// Necesidad de vinculación del caso que todavía no tiene invitación: el agente sigue reuniendo los
// datos del responsable desde el mensaje en que se declaró (F4).
export async function pendingGuardianNeed(db, caseId) {
  return (
    await query(
      db,
      `SELECT TOP 1 n.idNecesidad id, n.idMensajeEvidencia messageId FROM dbo.NecesidadVinculacion n
    WHERE n.idCaso=@caseId AND NOT EXISTS (SELECT 1 FROM dbo.InvitacionVinculacion i WHERE i.idNecesidad=n.idNecesidad)
    ORDER BY n.idNecesidad DESC`,
      { caseId },
    )
  ).recordset[0];
}
export async function incomingSince(db, id, messageId) {
  return (
    await query(
      db,
      'SELECT textoMensaje text FROM dbo.Mensaje WHERE idLeadCaso=@id AND idDireccion=1 AND idMensaje>=@messageId ORDER BY idMensaje',
      { id, messageId },
    )
  ).recordset.map((row) => row.text);
}
// Familiares registrados del mismo beneficiario con el rol indicado, con su participación más
// reciente (la autorización de contacto pertenece al familiar, no al estudiante).
export async function listRelatives(db, { beneficiary, contact, roles }) {
  return (
    await query(
      db,
      `SELECT
  l.idContacto contact,
  MAX(lc.idLeadCaso) participationId
FROM
  dbo.Lead l
  JOIN dbo.LeadCaso lc ON lc.idLead = l.idLead
WHERE
  l.idBeneficiario = @beneficiary
  AND l.idContacto <> @contact
  AND l.idRolContacto IN (SELECT CAST(value AS TINYINT) FROM STRING_SPLIT(@roles, ','))
GROUP BY
  l.idContacto`,
      { beneficiary, contact, roles: roles.join(',') },
    )
  ).recordset;
}
