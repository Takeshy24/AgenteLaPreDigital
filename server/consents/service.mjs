import { transaction } from '../db.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getParticipation, scheduleAttempts } from '../shared/repository.mjs';
import * as repository from './repository.mjs';
export async function saveConsent(id, data) {
  return transaction(async (db) => {
    const participation = await getParticipation(db, id);
    const usable = (
      await repository.getContact(db, {
        contact: participation.idContacto,
      })
    ).recordset[0];
    if (
      data.granted &&
      !(data.channel === 1
        ? usable.telefono
        : data.channel === 2
          ? usable.correo
          : usable.usuarioTelegram && usable.inicioBotTelegram)
    )
      throw new BusinessError('El canal aún no puede utilizarse.');
    await repository.revokeChannel(db, {
      contact: participation.idContacto,
      channel: data.channel,
    });
    if (data.granted)
      await repository.grantChannel(db, { ...data, contact: participation.idContacto });
    const active =
      (await repository.listConsent(db, { contact: participation.idContacto })).recordset.length >
      0;
    if (!active) await repository.suspendContact(db, { contact: participation.idContacto });
    if (active) {
      await repository.resumeContact(db, { contact: participation.idContacto });
      for (const row of (await repository.listActive(db, { contact: participation.idContacto }))
        .recordset)
        await scheduleAttempts(db, row.id);
    }
    return { saved: true };
  });
}
