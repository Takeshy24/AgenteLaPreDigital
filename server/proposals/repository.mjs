import { query } from '../db.mjs';
import { insert, now } from '../shared/repository.mjs';
export async function getTariff(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  t.*,
  p.nombre
FROM
  dbo.PlanTarifa t
  JOIN dbo.PlanComercial p ON p.idPlan = t.idPlan
WHERE
  idPlanTarifa = @tariff
  AND vigenciaDesde <= CAST(${now} AS DATE)
  AND (
    vigenciaHasta IS NULL
    OR vigenciaHasta >= CAST(${now} AS DATE)
  )`,
    params,
  );
}
export async function findIncoming(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  idMensaje
FROM
  dbo.Mensaje
WHERE
  idMensaje = @replyTo
  AND idLeadCaso = @id
  AND idDireccion = 1`,
    params,
  );
}
export async function insertPendingMessage(db, params = {}, options = {}) {
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
    idOperador,
    esAutomatico
  )
VALUES
  (
    @contact,
    @lead,
    @id,
    2,
    @channel,
    @source,
    @replyTo,
    @text,
    1,
    @op,
    @automatic
  )`,
    params,
  );
}
export async function insertProposal(db, params = {}, options = {}) {
  return insert(
    db,
    `INSERT
  dbo.PropuestaComercial (
    idCaso,
    idLeadCasoEntrega,
    idPlanTarifa,
    precioAutorizado,
    idOperadorAprueba,
    idMensajeEntrega
  )
VALUES
  (@caseId, @id, @tariff, @price, @op, @messageId)`,
    params,
  );
}
export async function getProposal(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  *
FROM
  dbo.PropuestaComercial
WITH
  (UPDLOCK, HOLDLOCK)
WHERE
  idPropuesta = @id`,
    params,
  );
}
export async function findReply(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  m.idLeadCaso,
  m.fechaHora
FROM
  dbo.Mensaje m
  JOIN dbo.LeadCaso lc ON lc.idLeadCaso = m.idLeadCaso
WHERE
  m.idMensaje = @messageId
  AND m.idDireccion = 1
  AND lc.idCaso = @caseId`,
    params,
  );
}
export async function findDelivery(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  fechaEntrega
FROM
  dbo.Mensaje
WHERE
  idMensaje = @m
  AND idEstadoEntrega = 2`,
    params,
  );
}
export async function saveResponse(db, params = {}, options = {}) {
  return query(
    db,
    `UPDATE dbo.PropuestaComercial
SET
  idResultado = @result,
  aceptacionExpresa = @accepted,
  idLeadCasoAcepta = @participant,
  idMensajeRespuesta = @messageId
WHERE
  idPropuesta = @id`,
    params,
  );
}
