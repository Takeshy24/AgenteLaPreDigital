import { addEvent, closeCase, getCase, saveEvidence } from '../cases/repository.mjs';
import { transaction } from '../db.mjs';
import { getProposal } from '../proposals/repository.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getOperator } from '../shared/repository.mjs';
import * as repository from './repository.mjs';
import { createSession, getSession } from './stripe.mjs';
import { prepareAccess, retryDelivery } from '../access/service.mjs';
async function caseOrFail(db, id) {
  const current = await getCase(db, id);
  if (!current) throw new BusinessError('Caso no encontrado', 404);
  return current;
}
export async function acceptTerms(caseId, data, options = {}) {
  return transaction(async (db) => {
    const current = await caseOrFail(db, caseId);
    if (current.idEstadoCaso !== 1) throw new BusinessError('Caso cerrado.');
    const existing = await repository.getContract(db, caseId);
    if (existing) {
      if (existing.idPropuestaAceptada !== data.proposalId)
        throw new BusinessError('Ya hay una contratación asociada a otra propuesta.');
      return { id: existing.idContratacion };
    }
    const proposal = (await getProposal(db, { id: data.proposalId })).recordset[0];
    if (
      !proposal ||
      proposal.idCaso !== caseId ||
      proposal.idResultado !== 1 ||
      !proposal.aceptacionExpresa
    )
      throw new BusinessError('Se requiere una propuesta del caso aceptada expresamente.');
    const operator = options.public ? null : await getOperator(db);
    const event = await addEvent(db, {
      caseId,
      type: 5,
      proposal: data.proposalId,
      participant: proposal.idLeadCasoAcepta,
    });
    await saveEvidence(db, {
      caseId,
      operation: 'terms-accepted',
      reference: data.reference,
      operator,
    });
    return {
      id: await repository.insertContract(db, {
        caseId,
        proposal: data.proposalId,
        event,
        stage: current.idEtapa,
      }),
    };
  });
}
export async function recordPayment(caseId, data, options = {}) {
  return transaction(async (db) => {
    const current = await caseOrFail(db, caseId);
    const contract = await repository.getContract(db, caseId);
    if (!contract) throw new BusinessError('Primero registra la aceptación de condiciones.');
    if (contract.idEventoPago) {
      if (
        contract.referenciaPago === data.reference &&
        Number(contract.importeConfirmado) === data.amount
      )
        return { saved: true };
      throw new BusinessError('El pago de esta contratación ya está registrado.');
    }
    if (current.idEstadoCaso !== 1) throw new BusinessError('Caso cerrado.');
    if (data.amount !== Number(contract.precioAutorizado))
      throw new BusinessError('El importe confirmado debe coincidir con la propuesta autorizada.');
    if (await repository.findPaymentReference(db, data.reference))
      throw new BusinessError('La referencia de pago ya se utilizó.');
    const operator = options.stripe ? null : await getOperator(db);
    const event = await addEvent(db, { caseId, type: 6, participant: contract.idLeadCasoAcepta });
    await repository.savePayment(db, contract.idContratacion, event, data.reference, data.amount);
    await saveEvidence(db, {
      caseId,
      operation: options.stripe ? 'stripe-payment-confirmed' : 'external-payment-attestation',
      reference: data.reference,
      operator,
    });
    return { saved: true, contractValidated: false };
  });
}
export async function startStripeCheckout(caseId, origin, returnPath) {
  const contract = await transaction(async (db) => {
    const current = await caseOrFail(db, caseId);
    if (current.idEstadoCaso !== 1) throw new BusinessError('Caso cerrado.');
    const value = await repository.getContract(db, caseId);
    if (!value) throw new BusinessError('Primero registra la aceptación de condiciones.');
    if (value.idEventoPago) throw new BusinessError('El pago ya está registrado.');
    return value;
  });
  return createSession({
    caseId,
    contractId: contract.idContratacion,
    amount: contract.precioAutorizado,
    plan: `Plan LaPreDigital · propuesta ${contract.idPropuestaAceptada}`,
    origin,
    returnPath,
  });
}
export async function confirmStripeCheckout(caseId, sessionId) {
  const session = await getSession(sessionId);
  if (
    session.livemode ||
    session.mode !== 'payment' ||
    session.payment_status !== 'paid' ||
    session.currency !== 'pen' ||
    session.metadata?.caseId !== String(caseId)
  )
    throw new BusinessError('Stripe todavía no confirma el pago de este caso.');
  const contract = await transaction((db) => repository.getContract(db, caseId));
  if (
    !contract ||
    session.metadata.contractId !== String(contract.idContratacion) ||
    session.amount_total !== Math.round(Number(contract.precioAutorizado) * 100)
  )
    throw new BusinessError('La sesión no coincide con la contratación y su importe.');
  return recordPayment(
    caseId,
    {
      reference: session.id,
      amount: Number(contract.precioAutorizado),
    },
    { stripe: true },
  );
}
export async function simulatePayment(caseId) {
  if (process.env.DEMO_PAYMENTS !== '1')
    throw new BusinessError('El pago simulado está desactivado. Define DEMO_PAYMENTS=1 en .env.');
  const contract = await transaction((db) => repository.getContract(db, caseId));
  if (!contract) throw new BusinessError('Primero registra la aceptación de condiciones.');
  if (contract.idEventoPago) return { saved: true };
  return recordPayment(caseId, {
    reference: `demo_pago_${caseId}_${Date.now()}`,
    amount: Number(contract.precioAutorizado),
  });
}
export async function validateContract(caseId) {
  return transaction(async (db) => {
    const current = await caseOrFail(db, caseId);
    const contract = await repository.getContract(db, caseId);
    if (!contract?.idEventoPago || !contract.importeConfirmado)
      throw new BusinessError('Falta un pago positivo confirmado externamente.');
    if (contract.idEventoValidacion) return { validated: true };
    if (current.idEstadoCaso !== 1) throw new BusinessError('Caso cerrado.');
    const operator = await getOperator(db);
    const event = await addEvent(db, {
      caseId,
      type: 7,
      participant: contract.idLeadCasoAcepta,
      operator,
      stage: current.idEtapa === 1 ? 2 : current.idEtapa,
    });
    await repository.saveValidation(db, contract.idContratacion, event);
    await closeCase(db, {
      caseId,
      reason: 1,
      participant: contract.idLeadCasoAcepta,
      converted: contract.idLeadCasoAcepta,
      operator,
    });
    return { validated: true };
  });
}
export async function activateService(caseId) {
  return transaction(async (db) => {
    await caseOrFail(db, caseId);
    const contract = await repository.getContract(db, caseId);
    if (!contract?.idEventoValidacion) throw new BusinessError('Contratación todavía no validada.');
    if (await repository.hasRefund(db, caseId))
      throw new BusinessError('La contratación fue invalidada por reembolso.');
    if (contract.fechaHabilitacion) return { activated: true };
    const operator = await getOperator(db);
    const access = await prepareAccess(db, {
      caseId,
      contractId: contract.idContratacion,
      operator,
    });
    await repository.activateContract(db, contract.idContratacion);
    await addEvent(db, { caseId, type: 14, operator, stage: 3 });
    return { activated: true, username: access.username, credentialsQueued: true };
  });
}
export async function retryAccessDelivery(caseId) {
  return transaction(async (db) => {
    await caseOrFail(db, caseId);
    const contract = await repository.getContract(db, caseId);
    if (!contract?.fechaHabilitacion) throw new BusinessError('Primero habilita el servicio.');
    if (await repository.hasRefund(db, caseId))
      throw new BusinessError('La contratación fue invalidada.');
    return retryDelivery(db, {
      caseId,
      contractId: contract.idContratacion,
      operator: await getOperator(db),
    });
  });
}
export async function paymentIncident(caseId, data) {
  return transaction(async (db) => {
    const current = await caseOrFail(db, caseId);
    const contract = await repository.getContract(db, caseId);
    if (!contract?.idEventoPago) throw new BusinessError('El caso no tiene un pago confirmado.');
    const operator = await getOperator(db);
    if (data.type === 'refund') {
      if (!contract.idEventoValidacion || current.idEstadoCaso !== 2)
        throw new BusinessError('La contratación debe estar validada y cerrada.');
      if (contract.fechaHabilitacion)
        throw new BusinessError(
          'El servicio ya fue habilitado. Registra un reembolso posterior, sin invalidar la etapa.',
        );
      if (await repository.hasRefund(db, caseId))
        throw new BusinessError('La invalidación ya fue registrada.');
      const event = await addEvent(db, { caseId, type: 9, stage: contract.previousStage });
      await repository.addBlock(db, current.idBeneficiario, event, 1);
    } else if (data.type === 'dispute') {
      const event = await addEvent(db, { caseId, type: 11 });
      await repository.addBlock(db, current.idBeneficiario, event, 2);
    } else await addEvent(db, { caseId, type: data.type === 'resolution' ? 12 : 10 });
    await saveEvidence(db, { caseId, operation: data.type, reference: data.reference, operator });
    return { saved: true };
  });
}
export async function authorizeScholarship(caseId, data) {
  return transaction(async (db) => {
    const current = await caseOrFail(db, caseId);
    if (current.idEstadoCaso !== 1) throw new BusinessError('Caso cerrado.');
    if (await repository.getScholarship(db, caseId))
      throw new BusinessError('Ya existe una beca autorizada en este caso.');
    if (await repository.getContract(db, caseId))
      throw new BusinessError('Existe contratación en curso.');
    if (new Date(data.endDate + 'T23:59:59-05:00') < new Date())
      throw new BusinessError('La vigencia debe ser futura.');
    await repository.recordScholarship(db, { caseId, ...data, operator: await getOperator(db) });
    return { authorized: true };
  });
}
export async function activateScholarship(caseId) {
  return transaction(async (db) => {
    const current = await caseOrFail(db, caseId);
    const scholarship = await repository.getScholarship(db, caseId);
    if (!scholarship) throw new BusinessError('Falta autorización de beca.');
    if (scholarship.activatedAt) return { activated: true };
    if (current.idEstadoCaso !== 1) throw new BusinessError('Caso cerrado.');
    if (new Date(scholarship.endDate.slice(0, 10) + 'T23:59:59-05:00') < new Date())
      throw new BusinessError('La beca autorizada venció.');
    const operator = await getOperator(db);
    const event = await addEvent(db, { caseId, type: 8, operator, stage: 3 });
    await repository.activateScholarship(db, caseId, event, scholarship);
    await closeCase(db, { caseId, reason: 2, operator });
    return { activated: true };
  });
}
