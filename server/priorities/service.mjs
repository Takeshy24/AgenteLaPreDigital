import { transaction } from '../db.mjs';
import { priorityFor } from '../policy.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getOperator, getParticipation } from '../shared/repository.mjs';
import * as repository from './repository.mjs';
export async function evaluatePriority(
  db,
  participation,
  level,
  evidence,
  trigger = 2,
  source = 3,
) {
  if (participation.idEstadoCaso !== 1 || participation.idEstadoParticipacion >= 3)
    throw new BusinessError('No se evalúan participaciones de casos cerrados.');
  const params = Object.fromEntries(
    (await repository.listParameters(db, undefined)).recordset.map((x) => [x.codigo, x.valor]),
  );
  const count = (
    await repository.countUnanswered(db, {
      id: participation.idLeadCaso,
      days: params.PLAZO_RESPUESTA_TRAS_SEPTIMO_DIAS,
    })
  ).recordset[0].count;
  const decision = priorityFor(level, count, params.UMBRAL_BAJA, params.UMBRAL_NULA);
  const operatorId = source === 3 ? await getOperator(db) : null;
  await repository.insertEvaluation(db, {
    id: participation.idLeadCaso,
    prev: participation.idPrioridadActual,
    ...decision,
    level,
    trigger,
    evidence,
    op: operatorId,
    source,
    count,
    allowed: participation.idEstadoParticipacion === 1 && decision.priority !== 5,
  });
  return decision;
}
export async function saveEvaluation(id, data) {
  return transaction(async (db) => {
    const participation = await getParticipation(db, id);
    if (
      data.messageId &&
      !(await repository.findEvidence(db, { m: data.messageId, id })).recordset.length
    )
      throw new BusinessError('La evidencia no pertenece a esta participación.');
    if (data.level > 1 && !data.messageId)
      throw new BusinessError('Consulta o Compra requieren mensaje de evidencia.');
    return evaluatePriority(db, participation, data.level, data.messageId ?? null, 7);
  });
}
