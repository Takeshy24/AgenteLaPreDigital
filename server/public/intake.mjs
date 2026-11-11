import { randomBytes, createHash } from 'node:crypto';
import { transaction } from '../db.mjs';
import { createLead } from '../leads/service.mjs';
import * as contacts from '../leads/repository.mjs';
import { saveLink } from '../integrations/repository.mjs';
import { integrationConfig } from '../integrations/config.mjs';
import { createRequest, saveState, linkRequest } from '../onboarding/repository.mjs';
import { BusinessError } from '../shared/errors.mjs';
import * as repository from './repository.mjs';

export async function telegramLink(db, contact, { consent = false } = {}) {
  const config = integrationConfig().telegram;
  if (!config.username) return null;
  const token = randomBytes(24).toString('base64url');
  await saveLink(db, contact, createHash('sha256').update(token).digest('hex'), consent);
  return `https://t.me/${config.username.replace(/^@/, '')}?start=${token}`;
}

export async function registerInquiry(data, { operator = false, inquiryId = null } = {}) {
  return transaction(async (db) => {
    const previous = inquiryId
      ? await repository.getInquiry(db, inquiryId)
      : data.requestKey
        ? await repository.findRequest(db, data.requestKey)
        : null;
    if (inquiryId && !previous) throw new BusinessError('Solicitud no encontrada.', 404);
    if (previous?.idLeadCaso)
      return {
        requested: true,
        status: 'Vinculada',
        ...(operator
          ? { participationId: previous.idLeadCaso }
          : { telegramUrl: await telegramLink(db, previous.idContacto) }),
      };
    if (previous && !operator) return { requested: true, status: previous.estado };
    const id = inquiryId ?? (await repository.saveInquiry(db, data));
    if (!data.phone || !data.role || !data.consent) return { requested: true, status: 'Pendiente' };
    const params = {
      ...data,
      email: data.email.trim().toLowerCase(),
      communicationChannel: 2,
      channel: 1,
      beneficiaryName: data.beneficiary,
    };
    const matches = await contacts.findContacts(db, params);
    if (matches.recordset.length && !operator) {
      await repository.linkInquiry(db, id, null, null, 'Revisar identidad');
      return { requested: true, status: 'Revisar identidad' };
    }
    const contact = matches.recordset[0]?.id ?? (await contacts.insertContact(db, params));
    await contacts.grantConsent(db, { ...params, contact });
    if (data.role !== 1 && !data.beneficiary?.trim()) {
      const provisional = await createRequest(db, {
        contact,
        role: data.role,
        channel: 1,
        text: `Interés en ${data.plan}. Beneficiario pendiente.`,
      });
      await saveState(db, contact, { ...params, consent: undefined }, 'beneficiary', provisional);
      await repository.linkInquiry(db, id, contact, null, 'Completar datos', provisional);
      return {
        requested: true,
        status: 'Completar datos',
        telegramUrl: await telegramLink(db, contact),
      };
    }
    const candidates = await contacts.findBeneficiaryByName(
      db,
      (data.role === 1 ? data.name : data.beneficiary).trim().toUpperCase(),
    );
    if (candidates.length && !data.beneficiaryId) {
      if (operator)
        throw new BusinessError(
          'Confirma la identidad del beneficiario y utiliza su ID existente: ' +
            candidates.map((item) => item.id).join(', '),
        );
      await repository.linkInquiry(db, id, contact, null, 'Revisar identidad');
      return { requested: true, status: 'Revisar identidad' };
    }
    const participation = await createLead(params, { contactId: contact });
    if (previous?.idSolicitudProvisional)
      await linkRequest(db, {
        id: previous.idSolicitudProvisional,
        contact,
        lead: participation.id,
      });
    await repository.linkInquiry(db, id, contact, participation.id, 'Vinculada');
    return {
      requested: true,
      status: 'Vinculada',
      telegramUrl: await telegramLink(db, contact),
      ...(operator ? { participationId: participation.id } : {}),
    };
  });
}
