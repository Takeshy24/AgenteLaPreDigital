import { getIncoming } from '../cases/repository.mjs';
import { transaction } from '../db.mjs';
import { createLead } from '../leads/service.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getParticipation } from '../shared/repository.mjs';
import * as repository from './repository.mjs';
export async function inviteGuardian(id, data) {
  return transaction(async (db) => {
    const participation = await getParticipation(db, id);
    if (participation.idEstadoCaso !== 1) throw new BusinessError('Caso cerrado.');
    const message = await getIncoming(db, data.messageId, participation.idCaso);
    if (message?.idLeadCaso !== id)
      throw new BusinessError('La necesidad debe sustentarse en un mensaje del participante.');
    const need =
      (await repository.getNeed(db, participation.idCaso))?.id ??
      (await repository.addNeed(db, participation.idCaso, id, data.messageId));
    return repository.addInvitation(db, {
      need,
      name: data.name,
      phone: data.phone || null,
      role: data.role,
    });
  });
}
export async function acceptGuardian(code, data) {
  return transaction(async (db) => {
    const invitation = await repository.getInvitation(db, code);
    if (!invitation) throw new BusinessError('Invitación no encontrada', 404);
    if (invitation.fechaVinculacion) throw new BusinessError('La invitación ya fue aceptada.');
    if (invitation.idEstadoCaso !== 1)
      throw new BusinessError('El caso de esta invitación está cerrado.');
    if (!data.contactConsent || !data.linkConsent)
      throw new BusinessError('Se necesitan ambas autorizaciones expresas.');
    const channels = data.channels?.length ? data.channels : [data.channel];
    const participant = await createLead(
      {
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: invitation.idRolInvitado,
        beneficiaryId: invitation.idBeneficiario,
        channel: null,
        communicationChannel: channels[0],
        consent: true,
      },
      { channels },
    );
    const context = await getParticipation(db, participant.id);
    if (context.idCaso !== invitation.idCaso)
      throw new BusinessError('La negociación cambió durante la vinculación.');
    await repository.acceptInvitation(db, {
      invitation: invitation.idInvitacion,
      contact: context.idContacto,
      participation: participant.id,
    });
    return { id: participant.id };
  });
}
