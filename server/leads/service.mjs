import { transaction } from '../db.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { scheduleAttempts } from '../shared/repository.mjs';
import * as repository from './repository.mjs';
export async function createLead(data) {
  return transaction(async (db) => {
    const params = {
      ...data,
      name: data.name.trim().replace(/\s+/g, ' '),
      email: data.email?.trim().toLowerCase() || null,
      phone: data.phone?.replace(/\s/g, '') || null,
    };
    const match = await repository.findContacts(db, params);
    if (match.recordset.length > 1)
      throw new BusinessError('El correo y el teléfono corresponden a contactos distintos.');
    const contact = match.recordset[0]?.id ?? (await repository.insertContact(db, params));
    let beneficiary = data.beneficiaryId;
    if (!beneficiary && data.role === 1)
      beneficiary = (await repository.findStudent(db, { contact })).recordset[0]?.id;
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
      const beneficiaryName = (data.role === 1 ? params.name : data.beneficiaryName)
        ?.trim()
        .replace(/\s+/g, ' ');
      if (!beneficiaryName) throw new BusinessError('Falta identificar al beneficiario.');
      const candidates = await repository.findBeneficiaryByName(db, beneficiaryName.toUpperCase());
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
    const old = (await repository.findParticipation(db, { lead, caseId })).recordset[0];
    if (old) return { id: old.id };
    if (data.consent) await repository.grantConsent(db, { ...params, contact });
    const authorized = (await repository.findConsent(db, { contact })).recordset.length > 0;
    const id = await repository.insertParticipation(
      db,
      { lead, caseId, role: data.role, state: authorized ? 1 : 2, reason: authorized ? null : 2 },
      { authorized },
    );
    if (authorized) await scheduleAttempts(db, id);
    return { id };
  });
}
