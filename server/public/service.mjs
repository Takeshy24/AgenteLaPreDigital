import { createHash, randomBytes } from 'node:crypto';
import { pool, transaction } from '../db.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { recordIncoming } from '../messages/service.mjs';
import { recordProposalResponse } from '../proposals/service.mjs';
import { acceptTerms, confirmStripeCheckout, startStripeCheckout } from '../contracts/service.mjs';
import * as repository from './repository.mjs';

const hash = (token) => createHash('sha256').update(token).digest('hex');

export async function listPlans() {
  return repository.publicTariffs(await pool());
}

export async function requestPlan(data) {
  const tariffs = await listPlans();
  if (data.plan !== 'Explora UNT' && !tariffs.some((item) => item.plan === data.plan))
    throw new BusinessError('El plan solicitado no está vigente.');
  await transaction((db) => repository.saveInquiry(db, data));
  return { requested: true };
}

export async function getInquiries() {
  return repository.listInquiries(await pool());
}

export async function createOfferLink(proposalId, origin) {
  const token = randomBytes(32).toString('base64url');
  await transaction(async (db) => {
    const offer = await repository.getOfferByProposal(db, proposalId);
    if (!offer || offer.idEstadoEntrega !== 2 || offer.idResultado === 2)
      throw new BusinessError('La propuesta debe estar entregada y vigente.');
    await repository.saveOffer(db, proposalId, hash(token));
  });
  return { url: `${origin}/oferta/${token}`, expiresInDays: 7 };
}

async function requireOffer(db, token) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) throw new BusinessError('Enlace inválido.', 404);
  const offer = await repository.getOffer(db, hash(token));
  if (!offer) throw new BusinessError('El enlace expiró o no existe.', 404);
  return offer;
}

export async function viewOffer(token) {
  const offer = await requireOffer(await pool(), token);
  return {
    plan: offer.plan,
    modalidad: offer.modalidad,
    precio: offer.precioAutorizado,
    beneficiario: offer.beneficiario,
    contacto: offer.contacto,
    accepted: offer.idResultado === 1,
    termsAccepted: !!offer.idContratacion,
    paid: !!offer.idEventoPago,
    validated: !!offer.idEventoValidacion,
  };
}

export async function acceptOffer(token) {
  return transaction(async (db) => {
    const offer = await requireOffer(db, token);
    if (offer.idEstadoEntrega !== 2 || offer.idResultado === 2)
      throw new BusinessError('La propuesta ya no está disponible.');
    if (offer.idContratacion) return { accepted: true };
    if (!offer.idResultado) {
      const message = await recordIncoming(offer.idLeadCasoEntrega, {
        text: `Acepto expresamente la propuesta #${offer.idPropuesta} y sus condiciones para ${offer.beneficiario}.`,
        channel: 4,
        level: 3,
      });
      await recordProposalResponse(offer.idPropuesta, { messageId: message.id, result: 1 });
    }
    await acceptTerms(
      offer.idCaso,
      { proposalId: offer.idPropuesta, reference: `Aceptación digital: oferta #${offer.idOferta}` },
      { public: true },
    );
    return { accepted: true };
  });
}

export async function payOffer(token, origin) {
  const offer = await requireOffer(await pool(), token);
  if (!offer.idContratacion || offer.idEventoPago)
    throw new BusinessError('Acepta las condiciones antes de pagar, o el pago ya está registrado.');
  return startStripeCheckout(offer.idCaso, origin, `/oferta/${token}`);
}

export async function confirmOffer(token, sessionId) {
  const offer = await requireOffer(await pool(), token);
  await confirmStripeCheckout(offer.idCaso, sessionId);
  return { paid: true };
}
