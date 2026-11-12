import { transaction } from '../db.mjs';
import { getInvitation } from '../links/repository.mjs';
import { acceptGuardian } from '../links/service.mjs';
import { findContacts } from '../leads/repository.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { telegramLink } from './intake.mjs';
import { directInvitee } from '../links/direct.mjs';
export async function viewInvitation(code) {
  return transaction(async (db) => {
    const invitation = await getInvitation(db, code);
    if (!invitation || invitation.idEstadoCaso !== 1)
      throw new BusinessError('La invitación no existe o el caso ya se cerró.', 404);
    return {
      name: invitation.nombreInvitado,
      accepted: !!invitation.fechaVinculacion,
      known: !!(await directInvitee(db, code)),
    };
  });
}
export async function acceptPublicInvitation(code, data) {
  return transaction(async (db) => {
    // Invitación enviada directamente a un contacto registrado: su canal prueba la identidad, así que
    // se vincula ese contacto sin pedirle otra vez sus datos.
    const known = await directInvitee(db, code);
    if (known) {
      const result = await acceptGuardian(code, {
        ...data,
        name: known.name,
        email: known.email,
        phone: known.phone,
        channels: data.channels?.length ? data.channels : [known.channel],
      });
      const participant = await getParticipation(db, result.id);
      return {
        accepted: true,
        telegramUrl: (data.channels ?? [known.channel]).includes(3)
          ? await telegramLink(db, participant.idContacto)
          : null,
      };
    }
    if (!data.email || !data.phone)
      throw new BusinessError('Indica tu correo y tu teléfono para aceptar la invitación.');
    const matches = await findContacts(db, { email: data.email.toLowerCase() });
    if (matches.recordset.length)
      throw new BusinessError(
        'Tu correo ya está registrado. El personal comercial debe confirmar tu identidad y vincular la invitación.',
      );
    const channels = data.channels?.length ? data.channels : [2];
    const result = await acceptGuardian(code, { ...data, channels });
    const participant = await getParticipation(db, result.id);
    return {
      accepted: true,
      telegramUrl: channels.includes(3) ? await telegramLink(db, participant.idContacto) : null,
    };
  });
}
