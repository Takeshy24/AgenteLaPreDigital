import { createHash, randomBytes } from 'node:crypto';
import { transaction } from '../db.mjs';
import { evaluatePriority } from '../priorities/service.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getParameters } from '../shared/parameters.mjs';
import { getParticipation } from '../shared/repository.mjs';
import * as repository from './repository.mjs';
const hash = (code) => createHash('sha256').update(code).digest('hex');
export async function offerTrial(id) {
  return transaction(async (db) => {
    const participation = await getParticipation(db, id);
    if (participation.idEstadoCaso !== 1) throw new BusinessError('Caso cerrado.');
    if (await repository.getTrial(db, participation.idBeneficiario))
      throw new BusinessError('El beneficiario ya utilizó Explora UNT.');
    const token = randomBytes(24).toString('base64url');
    await repository.saveTrialLink(db, hash(token), id);
    return { token, expiresInHours: 24 };
  });
}
export async function activateTrial(token) {
  return transaction(async (db) => {
    const link = await repository.getTrialLink(db, hash(token));
    if (!link) throw new BusinessError('El enlace no es válido, expiró o ya fue utilizado.');
    const participation = await getParticipation(db, link.idLeadCaso);
    if (participation.idEstadoCaso !== 1) throw new BusinessError('El caso está cerrado.');
    if (await repository.getTrial(db, participation.idBeneficiario))
      throw new BusinessError('La prueba solo se permite una vez por beneficiario.');
    const parameters = await getParameters(db);
    const id = await repository.createTrial(
      db,
      participation.idBeneficiario,
      participation.idLeadCaso,
      parameters.DURACION_EXPLORA_DIAS,
      hash(token),
    );
    await evaluatePriority(db, participation, 3, null, 6, 2);
    return { id, days: parameters.DURACION_EXPLORA_DIAS };
  });
}
