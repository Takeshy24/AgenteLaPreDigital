import { resumeOpportunity } from '../cases/service.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { transaction } from '../db.mjs';
import { evaluatePriority } from '../priorities/service.mjs';
import { getParticipation } from '../shared/repository.mjs';
import * as repository from './repository.mjs';

export async function recordUnassigned(contact, text, channel = 3) {
  return transaction(async (db) => {
    const id = await repository.insertUnassigned(db, contact, text, channel);
    await repository.clearContactBlocks(db, contact, id);
    for (const row of await repository.listContactParticipants(db, contact)) {
      const before = await getParticipation(db, row.id);
      await repository.resumeOnReply(db, {
        id: row.id,
        messageId: id,
        b: before.idBeneficiario,
        contact,
      });
      const current = await getParticipation(db, row.id);
      await evaluatePriority(
        db,
        current,
        before.idPrioridadActual === 5 ? 1 : current.idNivelInteres,
        id,
        2,
        2,
      );
    }
    return { id };
  });
}
export async function assignUnassigned(contact, id) {
  return transaction(async (db) => {
    const participation = await getParticipation(db, id);
    if (participation.idContacto !== contact)
      throw new BusinessError('El contacto no pertenece a esa participación.');
    const message = await repository.latestUnassigned(db, contact);
    if (!message) return null;
    await repository.assignMessage(db, message.id, participation);
    for (const row of await repository.listContactParticipants(db, contact)) {
      const current = await getParticipation(db, row.id);
      await evaluatePriority(db, current, current.idNivelInteres, null, 2, 2);
    }
    return message;
  });
}
export async function recordIncoming(id, data, options = {}) {
  return transaction(async (db) => {
    const original = await getParticipation(db, id);
    const resumed = await resumeOpportunity(db, original, data.level);
    const participation = resumed || original;
    id = participation.idLeadCaso;
    const messageId = await repository.insertIncoming(db, {
      id,
      contact: participation.idContacto,
      lead: participation.idLead,
      ...data,
    });
    // Mensajes automáticos y rebotes se registran aparte del historial comercial.
    await repository.resumeOnReply(db, {
      id,
      messageId,
      b: participation.idBeneficiario,
      contact: participation.idContacto,
    });
    if (resumed) {
      const current = await getParticipation(db, id);
      const level =
        data.retraction || original.idPrioridadActual === 5
          ? data.level
          : Math.max(current.idNivelInteres, data.level);
      await evaluatePriority(
        db,
        current,
        level,
        messageId,
        original.idPrioridadActual === 5 ? 5 : 2,
        options.source ?? 3,
      );
    }
    return { id: messageId, participationId: id };
  });
}
