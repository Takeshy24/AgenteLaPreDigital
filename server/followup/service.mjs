import { listCaseIds } from '../cases/repository.mjs';
import { closeInactiveCase } from '../cases/service.mjs';
import { transaction } from '../db.mjs';
import { createReply, insideServiceWindow, markFailed } from '../integrations/repository.mjs';
import { resumeExpired } from '../handoffs/repository.mjs';
import { evaluatePriority } from '../priorities/service.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { getParameters } from '../shared/parameters.mjs';
import * as repository from './repository.mjs';
export async function reviewMaintenance() {
  return transaction(async (db) => {
    const resumed = await resumeExpired(db);
    for (const row of resumed.recordset) {
      const message = await repository.latestTelegramMessage(db, row.idContacto);
      if (message)
        await createReply(
          db,
          await getParticipation(db, message.idLeadCaso),
          'Tu consulta sigue pendiente de atención del personal comercial. Mientras tanto, puedo continuar ayudándote con los planes y tu preparación.',
          message.idMensaje,
        );
    }
    await repository.expireTrials(db);
    await repository.expireRequests(db);
    return { resumed: resumed.recordset.length };
  });
}
async function firstSendable(db, channels, contact, canSend) {
  for (const channel of channels) if (await canSend(channel.idCanal, contact, db)) return channel;
  return null;
}
// Bienvenida de la landing que espera una plantilla de WhatsApp sin aprobar: se marca como no
// enviada y el intento pasa al siguiente canal autorizado que pueda enviar (por ejemplo, el correo).
async function rerouteBlockedWelcomes(db, canSend) {
  let rerouted = 0;
  for (const attempt of await repository.listBlockedWelcomes(db)) {
    if (await insideServiceWindow(db, attempt.idContacto)) continue;
    const channels = (await repository.listChannels(db, attempt.idContacto)).filter(
      (channel) => channel.idCanal !== 1,
    );
    const authorization = await firstSendable(db, channels, attempt.idContacto, canSend);
    if (!authorization) continue;
    await markFailed(
      db,
      attempt.messageId,
      `No enviado por WhatsApp: Meta no aprobó la plantilla de bienvenida. Se envió por ${authorization.idCanal === 2 ? 'correo' : 'Telegram'}.`,
    );
    await repository.releaseAttempt(db, attempt.id);
    await repository.createAttemptMessage(db, attempt, authorization);
    rerouted++;
  }
  return rerouted;
}
export async function recordAutomaticEmail(contact, text) {
  return transaction((db) => repository.recordAutomaticSend(db, { contact, channel: 2, text }));
}
// prepare = false: revisión manual de la consola. No decide intentos (no hay canal que los envíe),
// así que los intentos vencidos quedan pendientes para el worker en lugar de omitirse.
// canSend(canal, contacto, db) decide si un canal puede enviar ahora. welcomeReady = false indica
// que Meta no aprobó la plantilla de bienvenida: esas bienvenidas se envían por otro canal autorizado.
export async function reviewFollowup({
  canSend = () => false,
  prepare = true,
  welcomeReady = null,
} = {}) {
  return transaction(async (db) => {
    const result = { prepared: 0, omitted: 0, evaluated: 0, closed: 0, rerouted: 0 };
    await reviewMaintenance();
    const parameters = await getParameters(db);
    if (prepare && welcomeReady === false)
      result.rerouted = await rerouteBlockedWelcomes(db, canSend);
    const pending = prepare ? await repository.listDue(db) : [];
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
      const authorization = await firstSendable(db, channels, attempt.idContacto, canSend);
      if (!authorization) {
        await repository.omitAttempt(db, attempt.id);
        result.omitted++;
        continue;
      }
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
