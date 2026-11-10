import { transaction } from '../db.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getOperator, getParticipation } from '../shared/repository.mjs';
import * as repository from './repository.mjs';
export async function openHandoff(id, data) {
  return transaction(async (db) => {
    const participation = await getParticipation(db, id);
    const current = await repository.getOpenHandoff(db, participation.idContacto);
    if (current) return { id: current.idDerivacion };
    return {
      id: await repository.openHandoff(
        db,
        participation.idContacto,
        data.reason,
        data.messageId ?? null,
      ),
    };
  });
}
export async function attendHandoff(id) {
  return transaction(async (db) => {
    const participation = await getParticipation(db, id);
    const handoff = await repository.getOpenHandoff(db, participation.idContacto);
    if (!handoff) throw new BusinessError('No existe derivación pendiente.');
    await repository.attendHandoff(db, handoff.idDerivacion, await getOperator(db));
    return { attended: true };
  });
}
