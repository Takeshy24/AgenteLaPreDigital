import { query } from '../db.mjs';
import { now } from '../shared/repository.mjs';
export async function listParameters(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  codigo,
  valor
FROM
  dbo.Param_Proceso`,
    params,
  );
}
export async function countUnanswered(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  COUNT(*) count
FROM
  dbo.IntentoContacto i
  JOIN dbo.Mensaje m ON m.idMensaje = i.idMensajeEnvio
  OUTER APPLY (
    SELECT
      TOP 1 j.fechaProgramada
    FROM
      dbo.IntentoContacto j
    WHERE
      j.idLeadCaso = i.idLeadCaso
      AND j.numeroIntento > i.numeroIntento
    ORDER BY
      j.numeroIntento
  ) n
WHERE
  i.idLeadCaso = @id
  AND m.idEstadoEntrega = 2
  AND NOT EXISTS (
    SELECT
      1
    FROM
      dbo.Mensaje r
    WHERE
      (r.idLeadCaso = @id OR (r.idLeadCaso IS NULL AND r.idContacto=(SELECT l.idContacto FROM dbo.Lead l JOIN dbo.LeadCaso lc ON lc.idLead=l.idLead WHERE lc.idLeadCaso=@id)))
      AND r.idDireccion = 1
      AND r.fechaHora >= m.fechaEntrega
  )
  AND COALESCE(
    n.fechaProgramada,
    DATEADD(DAY, @days, m.fechaEntrega)
  ) <= ${now}`,
    params,
  );
}
export async function insertEvaluation(db, params = {}, options = {}) {
  return query(
    db,
    `INSERT
  dbo.EvaluacionPrioridad (
    idLeadCaso,
    idPrioridadAnterior,
    idPrioridadAsignada,
    idNivelInteres,
    idReglaAplicada,
    idDisparador,
    idFuenteNivel,
    idMensajeEvidencia,
    idOperador,
    intentosSinRespuesta,
    seguimientoPermitido
  )
VALUES
  (
    @id,
    @prev,
    @priority,
    @level,
    @rule,
    @trigger,
    @source,
    @evidence,
    @op,
    @count,
    @allowed
  )`,
    params,
  );
}
export async function findEvidence(db, params = {}, options = {}) {
  return query(
    db,
    `SELECT
  1 ok
FROM
  dbo.Mensaje
WHERE
  idMensaje = @m
  AND idLeadCaso = @id
  AND idDireccion = 1`,
    params,
  );
}
