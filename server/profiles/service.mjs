import { transaction } from '../db.mjs';
import { BusinessError } from '../shared/errors.mjs';
import { getOperator, getParticipation } from '../shared/repository.mjs';
import * as repository from './repository.mjs';
export async function saveProfile(id, data, options = {}) {
  return transaction(async (db) => {
    const participation = await getParticipation(db, id);
    if (participation.idEstadoCaso !== 1) throw new BusinessError('El caso está cerrado');
    const operatorId = options.messageId ? null : await getOperator(db);
    await repository.ensureProfiles(db, {
      b: participation.idBeneficiario,
      c: participation.idContacto,
    });
    const fields = {
      university: [
        'PerfilBeneficiario',
        'universidadObjetivo',
        1,
        2,
        'idBeneficiario',
        participation.idBeneficiario,
      ],
      career: [
        'PerfilBeneficiario',
        'carreraDeseada',
        2,
        2,
        'idBeneficiario',
        participation.idBeneficiario,
      ],
      availability: [
        'PerfilBeneficiario',
        'disponibilidadEstudio',
        6,
        2,
        'idBeneficiario',
        participation.idBeneficiario,
      ],
      score: [
        'PerfilBeneficiario',
        'ultimoPuntaje',
        5,
        2,
        'idBeneficiario',
        participation.idBeneficiario,
      ],
      courses: [null, null, 3, 2, 'idBeneficiario', participation.idBeneficiario],
      applications: [null, null, 4, 2, 'idBeneficiario', participation.idBeneficiario],
      budget: [
        'PerfilContacto',
        'presupuestoMensual',
        7,
        1,
        'idContacto',
        participation.idContacto,
      ],
    };
    for (let [key, value] of Object.entries(data.fields)) {
      const [table, column, field, type, pk, entity] = fields[key];
      let old;
      if (key === 'courses') {
        const list = [
          ...new Set(
            []
              .concat(value)
              .flatMap((item) => String(item).split(/\s*(?:,|;|y|e)\s*/))
              .map((item) => item.trim())
              .filter((item) => item.length > 1),
          ),
        ]
          .map((item) => item.slice(0, 100))
          .sort();
        const current = await repository.getCourses(db, entity);
        if (current.join(', ') === list.join(', ') || !list.length) continue;
        await repository.replaceCourses(db, entity, list);
        old = current.length ? current.join(', ') : null;
        value = list.join(', ');
      } else if (key === 'applications') {
        value = String(value).trim().slice(0, 200);
        old = await repository.getLastApplication(db, entity);
        if (!value || old === value) continue;
        await repository.addApplication(db, entity, value);
      } else {
        old = (await repository.getField(db, { entity }, { column, table, pk })).recordset[0].value;
        if (String(old ?? '') === String(value ?? '')) continue;
      }
      await repository.saveField(
        db,
        {
          id,
          contact: participation.idContacto,
          type,
          ct: type === 1 ? participation.idContacto : null,
          bt: type === 2 ? participation.idBeneficiario : null,
          field,
          old: old == null ? null : String(old),
          new: String(value),
          value,
          entity,
          channel: data.channel,
          role: participation.idRolContacto,
          op: operatorId,
          changeType: options.messageId ? (old == null ? 1 : 2) : 3,
          reply: options.messageId ?? null,
        },
        { table, column, pk },
      );
    }
    return { saved: true };
  });
}
