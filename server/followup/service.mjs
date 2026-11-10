import { listCaseIds } from '../cases/repository.mjs';
import { closeInactiveCase } from '../cases/service.mjs';
import { transaction } from '../db.mjs';
import { resumeExpired } from '../handoffs/repository.mjs';
import { evaluatePriority } from '../priorities/service.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { getParameters } from '../shared/parameters.mjs';
import * as repository from './repository.mjs';
export async function reviewFollowup({ canSend = () => false } = {}) {
  return transaction(async (db) => {
    const result = { prepared: 0, omitted: 0, evaluated: 0, closed: 0 };
    await resumeExpired(db);
    await repository.expireTrials(db);
    const parameters = await getParameters(db);
    const pending = await repository.listDue(db);
    for (const attempt of pending) {
      const deadline = attempt.nextAttempt
        ? new Date(attempt.nextAttempt + '-05:00')
        : new Date(
            new Date(attempt.fechaProgramada + '-05:00').getTime() +
              parameters.PLAZO_RESPUESTA_TRAS_SEPTIMO_DIAS * 86400000,
          );
      const expired = deadline <= new Date();
      if (
        attempt.idEstadoCaso !== 1 ||
        attempt.idEstadoParticipacion !== 1 ||
        attempt.idPrioridadActual === 5 ||
        attempt.handoff ||
        attempt.blocked ||
        attempt.scholarshipPending ||
        expired
      ) {
        await repository.omitAttempt(db, attempt.id);
        result.omitted++;
        continue;
      }
      const channels = await repository.listChannels(db, attempt.idContacto);
      if (!channels.length) {
        await repository.omitAttempt(db, attempt.id);
        result.omitted++;
        continue;
      }
      const authorization = channels.find((channel) => canSend(channel.idCanal));
      if (!authorization) continue;
      await repository.createAttemptMessage(db, attempt, authorization);
      result.prepared++;
    }
    const candidates = new Map();
    for (const row of await repository.listEvaluable(db)) candidates.set(row.id, 3);
    for (const row of await repository.listDeadlineParticipants(db)) candidates.set(row.id, 4);
    for (const [id, trigger] of candidates) {
      const participation = await getParticipation(db, id);
      await evaluatePriority(
        db,
        participation,
        participation.idNivelInteres,
        null,
        participation.idPrioridadActual === 1 ? 1 : trigger,
        2,
      );
      result.evaluated++;
    }
    for (const row of await listCaseIds(db))
      if (await closeInactiveCase(db, row.id)) result.closed++;
    return result;
  });
}
