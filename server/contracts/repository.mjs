import { query } from '../db.mjs';
import { insert, now } from '../shared/repository.mjs';
export async function getContract(db, caseId) {
  return (
    await query(
      db,
      `SELECT
  k.*,
  s.previousStage,
  p.precioAutorizado,
  p.idLeadCasoAcepta
FROM
  dbo.Contratacion k
WITH
  (UPDLOCK, HOLDLOCK)
  JOIN dbo.PropuestaComercial p ON p.idPropuesta = k.idPropuestaAceptada
  LEFT JOIN dbo.App_ContractSnapshot s ON s.idContratacion = k.idContratacion
WHERE
  k.idCaso = @caseId`,
      { caseId },
    )
  ).recordset[0];
}
export async function insertContract(db, params) {
  const id = await insert(
    db,
    `INSERT
  dbo.Contratacion (idCaso, idPropuestaAceptada, idEventoAceptacion)
VALUES
  (@caseId, @proposal, @event)`,
    params,
  );
  await query(
    db,
    `INSERT
  dbo.App_ContractSnapshot (idContratacion, previousStage)
VALUES
  (@id, @stage)`,
    { id, stage: params.stage },
  );
  return id;
}
export async function savePayment(db, id, event, reference, amount) {
  await query(
    db,
    `UPDATE dbo.Contratacion
SET
  idEventoPago = @event,
  referenciaPago = @reference,
  importeConfirmado = @amount
WHERE
  idContratacion = @id
  AND idEventoPago IS NULL`,
    { id, event, reference, amount },
  );
}
export async function saveValidation(db, id, event) {
  await query(
    db,
    `UPDATE dbo.Contratacion
SET
  idEventoValidacion = @event
WHERE
  idContratacion = @id
  AND idEventoValidacion IS NULL`,
    { id, event },
  );
}
export async function activateContract(db, id) {
  await query(
    db,
    `UPDATE dbo.Contratacion
SET
  fechaHabilitacion = ${now}
WHERE
  idContratacion = @id
  AND fechaHabilitacion IS NULL`,
    { id },
  );
}
export async function findPaymentReference(db, reference) {
  return (
    await query(
      db,
      `SELECT
  idContratacion
FROM
  dbo.Contratacion
WHERE
  referenciaPago = @reference`,
      { reference },
    )
  ).recordset[0];
}
export async function addBlock(db, beneficiary, event, reason) {
  await query(
    db,
    `INSERT
  dbo.BloqueoPromocional (idBeneficiario, idMotivoBloqueo, idEventoOrigen)
VALUES
  (@beneficiary, @reason, @event)`,
    { beneficiary, reason, event },
  );
}
export async function recordScholarship(db, params) {
  await query(
    db,
    `INSERT
  dbo.App_Scholarship (idCaso, idPlan, idOperador, reference, endDate)
VALUES
  (@caseId, @plan, @operator, @reference, @endDate)`,
    params,
  );
}
export async function getScholarship(db, caseId) {
  return (
    await query(
      db,
      `SELECT
  *
FROM
  dbo.App_Scholarship
WITH
  (UPDLOCK, HOLDLOCK)
WHERE
  idCaso = @caseId`,
      { caseId },
    )
  ).recordset[0];
}
export async function activateScholarship(db, caseId, event, scholarship) {
  await query(
    db,
    `INSERT
  dbo.BecaCompleta (
    idEvento,
    idPlan,
    fechaAutorizacion,
    idOperadorAutoriza,
    fechaFinVigencia,
    fechaHabilitacion
  )
VALUES
  (
    @event,
    @plan,
    @authorized,
    @operator,
    @endDate,
    ${now}
  );

UPDATE dbo.App_Scholarship
SET
  activatedAt = ${now}
WHERE
  idCaso = @caseId`,
    {
      caseId,
      event,
      plan: scholarship.idPlan,
      authorized: scholarship.authorizedAt,
      operator: scholarship.idOperador,
      endDate: scholarship.endDate,
    },
  );
}
export async function hasRefund(db, caseId) {
  return (
    (
      await query(
        db,
        `SELECT
  1 ok
FROM
  dbo.EventoCaso
WHERE
  idCaso = @caseId
  AND idTipoEvento = 9`,
        { caseId },
      )
    ).recordset.length > 0
  );
}
