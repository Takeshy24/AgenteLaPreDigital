import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { close, query, rollbackTest } from '../db.mjs';
import { defaultPolicy, getPolicy, policySchema, savePolicy } from '../agent/policy.mjs';
import { nextKey } from '../agent/profile-flow.mjs';
import { queueNextStep } from '../agent/profile-service.mjs';
import { actOnAnalysis } from '../agent/service.mjs';
import { createLead } from '../leads/service.mjs';
import { recordIncoming } from '../messages/service.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { knowledgeFragments } from '../knowledge/service.mjs';
import { answerFromKnowledge } from '../agent/knowledge.mjs';

test('reglas SQL: al omitir preguntas opcionales respeta la recomendación activada o desactivada', async () => {
  try {
    await rollbackTest(async (db) => {
      await savePolicy({
        ...(await getPolicy(db)),
        optionalQuestions: false,
        recommendAfterProfile: false,
      });
      const participant = await lead();
      const text = 'Derecho, 2 horas al día, presupuesto 80 soles';
      const incoming = await recordIncoming(participant.id, { text, channel: 2, level: 1 });
      const fields = [
        { field: 'career', value: 'Derecho' },
        { field: 'availability', value: '2 horas al día' },
        { field: 'budget', value: '80' },
      ];
      await actOnAnalysis(participant.id, incoming.id, text, analysis({ fields }));
      let reply = (
        await query(
          db,
          'SELECT TOP 1 textoMensaje text FROM dbo.Mensaje WHERE idLeadCaso=@id AND idDireccion=2 ORDER BY idMensaje DESC',
          { id: participant.id },
        )
      ).recordset[0];
      assert.match(reply.text, /Gracias por compartir tus datos/);
      assert.doesNotMatch(reply.text, /79\.90/);
      await savePolicy({ ...(await getPolicy(db)), recommendAfterProfile: true });
      await queueNextStep(db, await getParticipation(db, participant.id), incoming.id);
      reply = (
        await query(
          db,
          'SELECT TOP 1 textoMensaje text FROM dbo.Mensaje WHERE idLeadCaso=@id AND idDireccion=2 ORDER BY idMensaje DESC',
          { id: participant.id },
        )
      ).recordset[0];
      assert.match(reply.text, /Meta UNT/);
      assert.match(reply.text, /79\.90/);
      assert.equal(
        (
          await query(db, 'SELECT COUNT(*) total FROM dbo.PreguntaPerfil WHERE idLeadCaso=@id', {
            id: participant.id,
          })
        ).recordset[0].total,
        0,
      );
    });
  } finally {
    await close();
  }
});

const analysis = (extra = {}) => ({
  level: 1,
  action: 'ask',
  retraction: false,
  fields: [],
  tariffId: null,
  understood: true,
  needsGuardian: false,
  guardian: null,
  ...extra,
});
async function lead() {
  return createLead({
    name: 'Prueba reglas ' + randomUUID(),
    email: `${randomUUID()}@example.test`,
    phone: '+51912345678',
    role: 1,
    channel: 1,
    communicationChannel: 2,
    consent: true,
  });
}
test('reglas: valida orden único y permite omitir preguntas opcionales', () => {
  assert.equal(nextKey({}, { questionOrder: ['budget', 'career', 'availability'] }), 'budget');
  assert.equal(
    nextKey(
      { career: 'Medicina', availability: '2 horas', budget: 50 },
      { optionalQuestions: false },
    ),
    null,
  );
  assert.equal(
    policySchema.safeParse({ ...defaultPolicy, questionOrder: ['career', 'career', 'budget'] })
      .success,
    false,
  );
  assert.equal(policySchema.safeParse({ ...defaultPolicy, arbitrary: true }).success, false);
});
test('reglas SQL: guarda versión, detecta conflicto y cambia la siguiente pregunta real', async () => {
  try {
    await rollbackTest(async (db) => {
      const initial = await getPolicy(db);
      const policy = await savePolicy({
        ...initial,
        questionOrder: ['budget', 'career', 'availability'],
      });
      assert.equal(policy.version, initial.version + 1);
      await assert.rejects(
        () => savePolicy(initial),
        (error) => error.status === 409,
      );
      const participant = await lead();
      const incoming = await recordIncoming(participant.id, { text: 'Hola', channel: 2, level: 1 });
      await queueNextStep(db, await getParticipation(db, participant.id), incoming.id);
      const field = (
        await query(
          db,
          'SELECT TOP 1 idCampoPerfil id FROM dbo.PreguntaPerfil WHERE idLeadCaso=@id ORDER BY idPregunta DESC',
          { id: participant.id },
        )
      ).recordset[0];
      assert.equal(field.id, 7);
    });
  } finally {
    await close();
  }
});
test('reglas SQL: desactivar preguntas evita el cuestionario en texto y en la bienvenida', async () => {
  try {
    await rollbackTest(async (db) => {
      await savePolicy({ ...(await getPolicy(db)), profileQuestions: false });
      const participant = await lead();
      const incoming = await recordIncoming(participant.id, { text: 'Hola', channel: 2, level: 1 });
      await actOnAnalysis(participant.id, incoming.id, 'Hola', analysis());
      await queueNextStep(db, await getParticipation(db, participant.id), incoming.id);
      assert.equal(
        (
          await query(db, 'SELECT COUNT(*) total FROM dbo.PreguntaPerfil WHERE idLeadCaso=@id', {
            id: participant.id,
          })
        ).recordset[0].total,
        0,
      );
    });
  } finally {
    await close();
  }
});
test('reglas SQL: desactivar enlaces deriva cada solicitud antes de generar propuestas, pruebas o invitaciones', async () => {
  try {
    await rollbackTest(async (db) => {
      await savePolicy({
        ...(await getPolicy(db)),
        proposalLinks: false,
        trialLinks: false,
        guardianInvitations: false,
      });
      const tariff = (await query(db, 'SELECT TOP 1 idPlanTarifa id FROM dbo.PlanTarifa'))
        .recordset[0].id;
      for (const item of [
        analysis({ action: 'proposal', tariffId: tariff, level: 3 }),
        analysis({ action: 'trial', level: 3 }),
        analysis({ needsGuardian: true }),
      ]) {
        const participant = await lead();
        const incoming = await recordIncoming(participant.id, {
          text: 'Solicitud de prueba de reglas',
          channel: 2,
          level: item.level,
        });
        await actOnAnalysis(participant.id, incoming.id, 'Solicitud de prueba de reglas', item);
        const contact = (await getParticipation(db, participant.id)).idContacto;
        const handoff = (
          await query(db, 'SELECT COUNT(*) total FROM dbo.Derivacion WHERE idContacto=@contact', {
            contact,
          })
        ).recordset[0];
        assert.equal(handoff.total, 1);
        assert.equal(
          (
            await query(
              db,
              'SELECT COUNT(*) total FROM dbo.PropuestaComercial WHERE idLeadCasoEntrega=@id',
              { id: participant.id },
            )
          ).recordset[0].total,
          0,
        );
      }
    });
  } finally {
    await close();
  }
});
test('conocimiento SQL: tiene precios y características y no recurre a fuentes ocultas al desactivarlo', async () => {
  try {
    await rollbackTest(async (db) => {
      const docs = await knowledgeFragments();
      assert.match(answerFromKnowledge('¿Cuánto cuesta Ruta UNT?', [], docs).text, /39\.90/);
      assert.match(
        answerFromKnowledge('¿Qué incluye Meta UNT Plus?', [], docs).text,
        /Meta UNT Plus/,
      );
      await query(db, 'UPDATE dbo.App_KnowledgeDocument SET activo=0');
      assert.equal(
        answerFromKnowledge(
          '¿Cuánto cuesta Ruta UNT?',
          [{ plan: 'Ruta UNT', precio: 39.9 }],
          await knowledgeFragments(),
        ),
        null,
      );
    });
  } finally {
    await close();
  }
});
