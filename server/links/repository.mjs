import { query } from '../db.mjs';
import { insert, now } from '../shared/repository.mjs';
export async function getNeed(db, caseId) {
  return (
    await query(
      db,
      `SELECT
  TOP 1 idNecesidad id
FROM
  dbo.NecesidadVinculacion
WITH
  (UPDLOCK, HOLDLOCK)
WHERE
  idCaso = @caseId
ORDER BY
  fechaNecesidad,
  idNecesidad`,
      { caseId },
    )
  ).recordset[0];
}
export async function addNeed(db, caseId, participant, message) {
  return insert(
    db,
    `INSERT
  dbo.NecesidadVinculacion (idCaso, idLeadCasoDeclara, idMensajeEvidencia)
VALUES
  (@caseId, @participant, @message)`,
    { caseId, participant, message },
  );
}
export async function addInvitation(db, data) {
  const id = await insert(
    db,
    `INSERT
  dbo.InvitacionVinculacion (
    idNecesidad,
    nombreInvitado,
    telefonoInvitado,
    idRolInvitado
  )
VALUES
  (@need, @name, @phone, @role)`,
    data,
  );
  return (
    await query(
      db,
      `SELECT
  idInvitacion id,
  codigoEnlace code
FROM
  dbo.InvitacionVinculacion
WHERE
  idInvitacion = @id`,
      { id },
    )
  ).recordset[0];
}
export async function getInvitation(db, code) {
  return (
    await query(
      db,
      `SELECT
  i.*,
  n.idCaso,
  c.idBeneficiario,
  c.idEstadoCaso
FROM
  dbo.InvitacionVinculacion i
WITH
  (UPDLOCK, HOLDLOCK)
  JOIN dbo.NecesidadVinculacion n ON n.idNecesidad = i.idNecesidad
  JOIN dbo.Caso c ON c.idCaso = n.idCaso
WHERE
  i.codigoEnlace = @code`,
      { code },
    )
  ).recordset[0];
}
export async function acceptInvitation(db, data) {
  await query(
    db,
    `INSERT
  dbo.AutorizacionVinculacion (idInvitacion, idEstadoAutorizacion)
VALUES
  (@invitation, 1);

UPDATE dbo.InvitacionVinculacion
SET
  idResponsable = @contact,
  idLeadCasoResponsable = @participation,
  fechaVinculacion = ${now}
WHERE
  idInvitacion = @invitation
  AND fechaVinculacion IS NULL`,
    data,
  );
}
export async function listInvitations(db, caseId) {
  return (
    await query(
      db,
      `SELECT
  i.idInvitacion,
  i.nombreInvitado,
  i.codigoEnlace,
  i.fechaVinculacion
FROM
  dbo.InvitacionVinculacion i
  JOIN dbo.NecesidadVinculacion n ON n.idNecesidad = i.idNecesidad
WHERE
  n.idCaso = @caseId`,
      { caseId },
    )
  ).recordset;
}
