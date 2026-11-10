import { transaction } from '../db.mjs';
import { evaluatePriority } from '../priorities/service.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getOperator, getParticipation } from '../shared/repository.mjs';
import * as repository from './repository.mjs';
export async function prepareProposal(id, data, options = {}) {
  return transaction(async (db) => {
    const participation = await getParticipation(db, id);
    if (participation.idEstadoCaso !== 1) throw new BusinessError('Caso cerrado.');
    const tariff = (await repository.getTariff(db, data)).recordset[0];
    if (!tariff) throw new BusinessError('La tarifa no está vigente.');
    const incoming = (await repository.findIncoming(db, { ...data, id })).recordset[0];
    if (!incoming)
      throw new BusinessError(
        'Selecciona un mensaje entrante de esta participación como contexto de respuesta.',
      );
    const text = `Propuesta ${tariff.nombre}. Precio autorizado S/ ${Number(tariff.precio).toFixed(2)} por periodo contratado. ${data.justification}`;
    const messageId = await repository.insertPendingMessage(db, {
      ...data,
      id,
      contact: participation.idContacto,
      lead: participation.idLead,
      text,
      op: options.agent ? null : await getOperator(db),
      source: options.agent ? 2 : 3,
      automatic: !!options.agent,
    });
    const proposalId = await repository.insertProposal(db, {
      caseId: participation.idCaso,
      id,
      tariff: tariff.idPlanTarifa,
      price: tariff.precio,
      op: options.agent ? null : await getOperator(db),
      messageId,
    });
    return { id: proposalId, messageId, delivery: 'Pendiente de envío externo' };
  });
}
export async function recordProposalResponse(id, data) {
  return transaction(async (db) => {
    const proposal = (await repository.getProposal(db, { id })).recordset[0];
    if (!proposal) throw new BusinessError('Propuesta no encontrada', 404);
    const participation = await getParticipation(db, proposal.idLeadCasoEntrega);
    if (participation.idEstadoCaso !== 1) throw new BusinessError('El caso está cerrado.');
    const evidence = (
      await repository.findReply(db, { messageId: data.messageId, caseId: proposal.idCaso })
    ).recordset[0];
    if (!evidence) throw new BusinessError('Respuesta entrante del caso requerida.');
    if (proposal.idResultado) {
      if (proposal.idResultado === data.result && proposal.idMensajeRespuesta === data.messageId)
        return { saved: true, paymentConfirmed: false };
      throw new BusinessError(
        'La propuesta ya tiene una respuesta registrada; prepara una nueva alternativa si corresponde.',
      );
    }
    const delivery = (await repository.findDelivery(db, { m: proposal.idMensajeEntrega }))
      .recordset[0];
    if (
      !(
        await repository.findDelivery(db, {
          m: proposal.idMensajeEntrega,
        })
      ).recordset.length
    )
      throw new BusinessError('No se puede aceptar una propuesta sin entrega confirmada.');
    if (evidence.fechaHora < delivery.fechaEntrega)
      throw new BusinessError('La respuesta debe ser posterior a la entrega de la propuesta.');
    await repository.saveResponse(db, {
      id,
      ...data,
      accepted: data.result === 1,
      participant: data.result === 1 ? evidence.idLeadCaso : null,
    });
    const responding = await getParticipation(db, evidence.idLeadCaso);
    await evaluatePriority(db, responding, data.result === 1 ? 3 : 2, data.messageId, 6, 2);
    return { saved: true, paymentConfirmed: false };
  });
}
