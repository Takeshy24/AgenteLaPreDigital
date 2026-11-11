import { transaction } from '../db.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { scheduleAttempts } from '../shared/repository.mjs';
import * as repository from './repository.mjs';
import { resumeContact, listActive } from '../consents/repository.mjs';
export async function createLead(data, options = {}) {
  return transaction((db) => saveLead(db, data, options));
}
// options.contactId: contacto ya identificado por quien llama (se verifica contra el correo).
// options.channels: canales autorizados al captar (por defecto, solo communicationChannel).
// options.reviewNameMatches: un nombre ya registrado por otro contacto queda como solicitud
// provisional en vez de fallar, para no revelar identificadores a quien escribe.
export async function saveLead(db, data, options = {}) {
  const channels = options.channels ?? [data.communicationChannel];
  const params = {
    ...data,
    name: data.name.trim().replace(/\s+/g, ' '),
    email: data.email?.trim().toLowerCase() || null,
    phone: data.phone?.replace(/\s/g, '') || null,
  };
  const match = await repository.findContacts(db, params);
  if (match.recordset.length > 1)
    throw new BusinessError('El correo y el teléfono corresponden a contactos distintos.');
  const contact =
    options.contactId ?? match.recordset[0]?.id ?? (await repository.insertContact(db, params));
  if (options.contactId && match.recordset.some((item) => item.id !== options.contactId))
    throw new BusinessError('La identidad requiere revisión del personal comercial.');
  const beneficiaryName = (data.role === 1 ? params.name : data.beneficiaryName)
    ?.trim()
    .replace(/\s+/g, ' ');
  let beneficiary = data.beneficiaryId;
  if (!beneficiary && data.role === 1)
    beneficiary = (await repository.findStudent(db, { contact })).recordset[0]?.id;
  if (!beneficiary && options.reviewNameMatches && beneficiaryName)
    beneficiary = (
      await repository.findContactBeneficiary(db, { contact, name: beneficiaryName.toUpperCase() })
    ).recordset[0]?.id;
  if (beneficiary) {
    if (
      !(
        await repository.findBeneficiary(db, {
          beneficiary,
        })
      ).recordset.length
    )
      throw new BusinessError('Beneficiario no encontrado', 404);
  } else {
    if (!beneficiaryName) throw new BusinessError('Falta identificar al beneficiario.');
    const candidates = await repository.findBeneficiaryByName(db, beneficiaryName.toUpperCase());
    if (candidates.length && options.reviewNameMatches) {
      if (data.consent) await grantConsents(db, params, contact, channels);
      await repository.insertProvisionalRequest(db, {
        contact,
        role: data.role,
        channel: data.channel,
        text: `Solicitud pública: el estudiante "${beneficiaryName}" coincide con un beneficiario ya registrado. Confirmar su identidad antes de vincularlo.`,
      });
      return { review: true, contact };
    }
    if (candidates.length)
      throw new BusinessError(
        'Hay un beneficiario con ese nombre. Confirma su identidad y usa el ID existente: ' +
          candidates.map((candidate) => candidate.id).join(', '),
      );
    beneficiary = await repository.insertBeneficiary(db, {
      beneficiaryName,
      studentContact: data.role === 1 ? contact : null,
    });
  }
  await repository.ensureProfiles(db, { contact, beneficiary });
  const existingLead = (await repository.findLead(db, { contact, beneficiary })).recordset[0];
  const lead =
    existingLead?.id ?? (await repository.insertLead(db, { ...params, contact, beneficiary }));
  let caseId = (await repository.findOpenCase(db, { beneficiary })).recordset[0]?.id;
  if (!caseId) {
    caseId = await repository.insertCase(db, {
      beneficiary,
    });
    await repository.recordCaseOpening(db, { caseId });
  }
  if (data.consent) await grantConsents(db, params, contact, channels);
  const old = (await repository.findParticipation(db, { lead, caseId })).recordset[0];
  if (old) {
    if (data.consent) {
      await resumeContact(db, { contact });
      for (const row of (await listActive(db, { contact })).recordset)
        await scheduleAttempts(db, row.id);
    }
    return { id: old.id, contact };
  }
  const authorized = (await repository.findConsent(db, { contact })).recordset.length > 0;
  const id = await repository.insertParticipation(
    db,
    { lead, caseId, role: data.role, state: authorized ? 1 : 2, reason: authorized ? null : 2 },
    { authorized },
  );
  if (authorized) await scheduleAttempts(db, id);
  return { id, contact };
}
async function grantConsents(db, params, contact, channels) {
  for (const communicationChannel of channels)
    await repository.grantConsent(db, { ...params, contact, communicationChannel });
}
