import { transaction } from '../db.mjs';
import { evaluatePriority } from '../priorities/service.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getParameters } from '../shared/parameters.mjs';
import { getOperator, getParticipation, scheduleAttempts } from '../shared/repository.mjs';
import * as repository from './repository.mjs';
export async function resumeOpportunity(db, participation, level) {
  const current = await repository.getCase(db, participation.idCaso);
  if (current.idEstadoCaso === 1) {
    if (participation.idEstadoParticipacion >= 3)
      await repository.resumeParticipant(db, participation.idLeadCaso);
    return getParticipation(db, participation.idLeadCaso);
  }
  if (level === 1) return null;
  const parameters = await getParameters(db);
  const other = await repository.getOtherCase(
    db,
    participation.idBeneficiario,
    participation.idCaso,
  );
  let caseId = other?.idCaso;
  const withinWindow =
    Date.now() - new Date(current.fechaCierre + '-05:00').getTime() <=
    parameters.REAPERTURA_DIAS * 86400000;
  if (!caseId && [3, 4].includes(current.idMotivoCierre) && withinWindow) {
    await repository.reopenCase(db, current.idCaso);
    await repository.resumeParticipant(db, participation.idLeadCaso);
    return getParticipation(db, participation.idLeadCaso);
  }
  caseId ??= await repository.createCase(db, participation.idBeneficiario);
  let target = (await repository.findParticipation(db, caseId, participation.idContacto))?.id;
  if (!target) {
    target = await repository.addParticipant(
      db,
      participation.idLead,
      caseId,
      participation.idRolContacto,
    );
    await repository.resumeParticipant(db, target);
    await startEligibility(db, target);
  } else await repository.resumeParticipant(db, target);
  return getParticipation(db, target);
}
export async function startEligibility(db, id) {
  await repository.startEligibility(db, id);
  await scheduleAttempts(db, id);
}
export async function withdraw(id, data) {
  return transaction(async (db) => {
    const participation = await getParticipation(db, id);
    if (participation.idEstadoCaso !== 1) throw new BusinessError('El caso ya está cerrado.');
    const message = await repository.getIncoming(db, data.messageId, participation.idCaso);
    if (!message || message.idLeadCaso !== id)
      throw new BusinessError('Se requiere mensaje entrante de esta participación.');
    const operator = await getOperator(db);
    await repository.saveEvidence(db, {
      caseId: participation.idCaso,
      operation: 'withdraw',
      reference: `Mensaje #${data.messageId}: ${data.reason}`,
      operator,
    });
    if (!(await repository.hasWithdrawalAuthority(db, id))) {
      await evaluatePriority(db, participation, 2, data.messageId, 6, 2);
      return { closed: false, retraction: true };
    }
    await repository.closeCase(db, {
      caseId: participation.idCaso,
      reason: 3,
      participant: id,
      operator,
    });
    return { closed: true };
  });
}
export async function closeInactiveCase(db, caseId, at = new Date()) {
  const current = await repository.getCase(db, caseId);
  if (current?.idEstadoCaso !== 1) return false;
  const activity = await repository.getInactivity(db, caseId);
  if (
    activity.pendingAgenda ||
    activity.openHandoff ||
    activity.pendingPayment ||
    activity.pendingScholarship
  )
    return false;
  const parameters = await getParameters(db);
  const latest = Math.max(
    ...[
      'fechaApertura',
      'lastIncoming',
      'lastEvent',
      'lastProposal',
      'lastAcceptance',
      'lastLink',
      'lastDeadline',
    ].map((key) => (activity[key] ? new Date(activity[key] + '-05:00').getTime() : 0)),
  );
  if (at.getTime() - latest < parameters.INACTIVIDAD_CASO_DIAS * 86400000) return false;
  await repository.closeCase(db, { caseId, reason: 4 });
  return true;
}
