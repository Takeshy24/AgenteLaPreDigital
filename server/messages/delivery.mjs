import * as repository from './repository.mjs';
import { saveEvidence } from '../cases/repository.mjs';
import { transaction } from '../db.mjs';
import { markSent } from '../integrations/repository.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getOperator } from '../shared/repository.mjs';
export async function confirmExternalDelivery(id, data) {
  return transaction(async (db) => {
    const message = await repository.getOutgoing(db, id);
    if (!message) throw new BusinessError('Mensaje no encontrado', 404);
    if (message.idCanal === 3)
      throw new BusinessError(
        'La entrega Telegram se confirma exclusivamente mediante el adaptador.',
      );
    if (message.idEstadoEntrega === 2) return { confirmed: true };
    await repository.ensureDispatch(db, id);
    await markSent(db, id, data.reference);
    await saveEvidence(db, {
      caseId: message.idCaso,
      operation: 'external-delivery-attestation',
      reference: `Mensaje #${id}: ${data.reference}`,
      operator: await getOperator(db),
    });
    return { confirmed: true };
  });
}
