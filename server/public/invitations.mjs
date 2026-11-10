import { transaction } from '../db.mjs';
import { getInvitation } from '../links/repository.mjs';
import { acceptGuardian } from '../links/service.mjs';
import { findContacts } from '../leads/repository.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { telegramLink } from './intake.mjs';
export async function viewInvitation(code) {
  return transaction(async (db) => {
    const invitation = await getInvitation(db, code);
    if (!invitation || invitation.idEstadoCaso !== 1)
      throw new BusinessError('La invitación no existe o el caso ya se cerró.', 404);
    return { name: invitation.nombreInvitado, accepted: !!invitation.fechaVinculacion };
  });
}
export async function acceptPublicInvitation(code, data) {
  return transaction(async (db) => {
    const matches = await findContacts(db, { email: data.email.toLowerCase() });
    if (matches.recordset.length)
      throw new BusinessError(
        'Tu correo ya está registrado. El personal comercial debe confirmar tu identidad y vincular la invitación.',
      );
    const result = await acceptGuardian(code, { ...data, channel: 2 });
    const participant = await getParticipation(db, result.id);
    return { accepted: true, telegramUrl: await telegramLink(db, participant.idContacto) };
  });
}
