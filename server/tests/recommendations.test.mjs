import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { close, pool, query, rollbackTest } from '../db.mjs';
import { app } from '../app.mjs';
import { loginAdmin } from '../test-support/login.mjs';
import { rankPlans, recommendationIntro } from '../agent/recommendation-rules.mjs';
import {
  getRecommendationSettings,
  setRecommendationSettings,
  buildDataRecommendation,
  previewRecommendation,
} from '../agent/recommendations.mjs';
import { listPlanChoices } from '../agent/recommendation-repository.mjs';
import { getPolicy, savePolicy } from '../agent/policy.mjs';
import { createLead } from '../leads/service.mjs';
import { recordIncoming } from '../messages/service.mjs';
import { saveProfile } from '../profiles/service.mjs';
import { actOnAnalysis } from '../agent/service.mjs';
import { publicTariffs } from '../public/repository.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { prepareProposal, recordProposalResponse } from '../proposals/service.mjs';
import { confirmExternalDelivery } from '../messages/delivery.mjs';
import {
  acceptTerms,
  recordPayment,
  validateContract,
  paymentIncident,
} from '../contracts/service.mjs';

const tariffs = [
  { id: 1, plan: 'Ruta UNT', modalidad: 'Mensual', precio: 39.9 },
  { id: 2, plan: 'Meta UNT', modalidad: 'Mensual', precio: 79.9 },
  { id: 3, plan: 'Meta UNT Plus', modalidad: 'Mensual', precio: 99.9 },
  { id: 4, plan: 'Meta UNT Plus', modalidad: 'Semestral', precio: 499.9 },
];
const profile = { career: 'Ingeniería de Sistemas', availability: '2 horas al día', budget: 100 };
const history = Array.from({ length: 8 }, (_, index) => ({
  beneficiaryId: index + 1,
  career: 'ingenieria de sistemas',
  availability: '2 horas al día',
  plan: index < 6 ? 'Meta UNT' : 'Ruta UNT',
}));
const student = { student: true };

test('recomendación: ordena por elecciones comparables, ofrece varios planes y respeta el presupuesto', () => {
  const result = rankPlans(profile, tariffs, history);
  assert.deepEqual(
    result.options.map((item) => item.tariff.plan),
    ['Meta UNT', 'Ruta UNT', 'Meta UNT Plus'],
  );
  assert.equal(result.cohortSize, 8);
  assert.equal(result.options[0].selectedBy, 6);
  assert.ok(
    result.options.every(
      (item) => item.tariff.modalidad === 'Mensual' && item.tariff.precio <= 100,
    ),
  );
  const smaller = rankPlans({ ...profile, budget: 40 }, tariffs, history);
  assert.deepEqual(
    smaller.options.map((item) => item.tariff.plan),
    ['Ruta UNT'],
  );
  assert.equal(rankPlans({ ...profile, budget: 0 }, tariffs, history).options.length, 0);
  assert.equal(rankPlans({ ...profile, budget: null }, tariffs, history).options.length, 0);
});
test('recomendación: no cuenta dos veces al estudiante ni atribuye preferencias con menos de cinco comparables', () => {
  const insufficient = rankPlans(profile, tariffs, [
    ...history.slice(0, 4),
    ...history.slice(0, 4),
  ]);
  assert.equal(insufficient.usesHistory, false);
  assert.equal(insufficient.options[0].tariff.plan, 'Meta UNT Plus');
  assert.equal(rankPlans({ ...profile, career: 'Derecho' }, tariffs, history).usesHistory, false);
  assert.match(
    recommendationIntro(profile, rankPlans(profile, tariffs, history), student),
    /6 de 8/,
  );
  assert.doesNotMatch(
    recommendationIntro(profile, rankPlans(profile, tariffs, history), student),
    /les ha ido muy bien|aprobaron|ingresaron|plan perfecto/,
  );
});
test('recomendación: aprovecha la disponibilidad cuando hay cinco perfiles coincidentes', () => {
  const rows = history.map((item, index) => ({
    ...item,
    availability: index < 5 ? 'Noche' : 'Mañana',
    plan: index < 5 ? 'Ruta UNT' : 'Meta UNT',
  }));
  const result = rankPlans({ ...profile, availability: 'Noche' }, tariffs, rows);
  assert.equal(result.cohortSize, 5);
  assert.equal(result.sameAvailability, true);
  assert.equal(result.options[0].tariff.plan, 'Ruta UNT');
});
async function fixture() {
  const id = randomUUID();
  return createLead({
    name: 'Recomendación ' + id,
    email: id + '@example.test',
    phone: '+51912345678',
    role: 1,
    channel: 1,
    communicationChannel: 2,
    consent: true,
  });
}
test('SQL: bloquea 49 LEADs en ambos accesos, permite 50 y conecta el modo con la conversación', async () => {
  try {
    await rollbackTest(async (db) => {
      await savePolicy({ ...(await getPolicy(db)), useLeadData: false, optionalQuestions: false });
      let settings = await getRecommendationSettings(db);
      if (settings.leads < 50) {
        for (let index = settings.leads; index < 49; index++) await fixture();
        settings = await getRecommendationSettings(db);
        assert.equal(settings.leads, 49);
        assert.equal(settings.eligible, false);
        await assert.rejects(
          () => setRecommendationSettings({ enabled: true, version: settings.version }),
          /al menos 50 LEADs/,
        );
        await assert.rejects(
          async () => savePolicy({ ...(await getPolicy(db)), useLeadData: true }),
          /al menos 50 LEADs/,
        );
        await fixture();
        assert.equal((await getRecommendationSettings(db)).leads, 50);
      }
      settings = await setRecommendationSettings({ enabled: true, version: settings.version });
      assert.equal(settings.enabled, true);
      await assert.rejects(
        () => setRecommendationSettings({ enabled: false, version: settings.version - 1 }),
        /configuración cambió/,
      );
      const participant = await fixture();
      const text = 'Ingeniería de Sistemas, 2 horas al día, 80 soles al mes';
      const evidence = await recordIncoming(participant.id, { text, channel: 2, level: 1 });
      await saveProfile(
        participant.id,
        {
          fields: { career: profile.career, availability: profile.availability, budget: 80 },
          channel: 2,
        },
        { messageId: evidence.id },
      );
      const question = '¿Qué plan me recomiendas?';
      const incoming = await recordIncoming(participant.id, {
        text: question,
        channel: 2,
        level: 2,
      });
      await actOnAnalysis(participant.id, incoming.id, question, {
        action: 'catalog',
        fields: [],
        level: 2,
        retraction: false,
        tariffId: null,
        understood: true,
        needsGuardian: false,
        guardian: null,
      });
      const reply = (
        await query(
          db,
          'SELECT TOP 1 m.textoMensaje text, d.markup FROM dbo.Mensaje m JOIN dbo.App_Dispatch d ON d.idMensaje=m.idMensaje WHERE m.idLeadCaso=@id AND m.idDireccion=2 ORDER BY m.idMensaje DESC',
          { id: participant.id },
        )
      ).recordset[0];
      assert.match(reply.text, /Mi primera opción/);
      assert.match(reply.text, /Otra alternativa/);
      assert.doesNotMatch(reply.text, /SIMULADO/);
      const buttons = JSON.parse(reply.markup).inline_keyboard.flat();
      assert.ok(buttons.some((item) => item.text === 'Elegir Meta UNT'));
      assert.ok(buttons.some((item) => item.text === 'Elegir Ruta UNT'));
      assert.ok(!buttons.some((item) => item.text.includes('Plus')));
      assert.ok(reply.text.length <= 4000);
      const accented = await recordIncoming(participant.id, {
        text: 'Recomiéndame un plan',
        channel: 2,
        level: 2,
      });
      await actOnAnalysis(participant.id, accented.id, 'Recomiéndame un plan', {
        action: 'ask',
        fields: [],
        level: 2,
        retraction: false,
        tariffId: null,
        understood: true,
        needsGuardian: false,
        guardian: null,
      });
      assert.match(
        (
          await query(
            db,
            'SELECT TOP 1 textoMensaje text FROM dbo.Mensaje WHERE idLeadCaso=@id AND idDireccion=2 ORDER BY idMensaje DESC',
            { id: participant.id },
          )
        ).recordset[0].text,
        /Mi primera opción/,
      );
      const result = await buildDataRecommendation(
        db,
        { ...profile, budget: 40 },
        await publicTariffs(db),
        student,
      );
      assert.ok(result.alternatives.every((item) => Number(item.precio) <= 40));
      await setRecommendationSettings({
        enabled: false,
        version: (await getRecommendationSettings(db)).version,
      });
      assert.equal(await buildDataRecommendation(db, profile, tariffs, student), null);
    });
  } finally {
    await close();
  }
});

test('SQL: se pausa por debajo del mínimo aunque la preferencia siga guardada', async () => {
  try {
    await rollbackTest(async (db) => {
      const settings = await getRecommendationSettings(db);
      if (settings.leads >= 50) return;
      await query(
        db,
        "UPDATE dbo.App_AgentPolicy SET configuracion=JSON_MODIFY(configuracion, '$.useLeadData', CAST(1 AS BIT)) WHERE id=1",
      );
      const paused = await getRecommendationSettings(db);
      assert.equal(paused.configured, true);
      assert.equal(paused.enabled, false);
      assert.equal(await buildDataRecommendation(db, profile, tariffs, student), null);
    });
  } finally {
    await close();
  }
});

test('SQL: el historial incluye pagos validados, excluye propuestas sueltas y devoluciones', async () => {
  try {
    await rollbackTest(async (db) => {
      const participant = await fixture();
      const before = await getParticipation(db, participant.id);
      await saveProfile(participant.id, {
        fields: { career: profile.career, availability: profile.availability },
        channel: 2,
      });
      const incoming = await recordIncoming(participant.id, {
        text: 'Quiero contratar Ruta UNT',
        channel: 2,
        level: 3,
      });
      const tariff = (await publicTariffs(db)).find((item) => item.plan === 'Ruta UNT');
      const proposal = await prepareProposal(participant.id, {
        tariff: tariff.id,
        replyTo: incoming.id,
        channel: 2,
        justification: 'Elección expresa para prueba de historial.',
      });
      await confirmExternalDelivery(proposal.messageId, {
        reference: 'prueba-envío-' + randomUUID(),
      });
      const accepted = await recordIncoming(participant.id, {
        text: 'Acepto la propuesta y condiciones',
        channel: 2,
        level: 3,
      });
      await recordProposalResponse(proposal.id, { messageId: accepted.id, result: 1 });
      await acceptTerms(before.idCaso, {
        proposalId: proposal.id,
        reference: 'Aceptación expresa de prueba.',
      });
      assert.ok(
        !(await listPlanChoices(db)).some((item) => item.beneficiaryId === before.idBeneficiario),
      );
      await recordPayment(before.idCaso, {
        reference: randomUUID(),
        amount: Number(tariff.precio),
      });
      assert.ok(
        !(await listPlanChoices(db)).some((item) => item.beneficiaryId === before.idBeneficiario),
      );
      await validateContract(before.idCaso);
      assert.ok(
        (await listPlanChoices(db)).some(
          (item) => item.beneficiaryId === before.idBeneficiario && item.plan === 'Ruta UNT',
        ),
      );
      assert.ok(
        !(await listPlanChoices(db, before.idBeneficiario)).some(
          (item) => item.beneficiaryId === before.idBeneficiario,
        ),
      );
      await paymentIncident(before.idCaso, {
        type: 'refund',
        reference: 'Devolución total de prueba.',
      });
      assert.ok(
        !(await listPlanChoices(db)).some((item) => item.beneficiaryId === before.idBeneficiario),
      );
    });
  } finally {
    await close();
  }
});

test('vista previa: identifica la simulación y no genera mensajes, invitaciones ni LEADs', async () => {
  try {
    const db = await pool();
    const before = (
      await query(
        db,
        'SELECT (SELECT COUNT(*) FROM dbo.Mensaje) messages, (SELECT COUNT(*) FROM dbo.Lead) leads',
      )
    ).recordset[0];
    const result = await previewRecommendation({ ...profile, simulation: true });
    assert.equal(result.simulation, true);
    assert.match(result.text, /^EJEMPLO SIMULADO/);
    assert.match(result.text, /6 de 8/);
    const after = (
      await query(
        db,
        'SELECT (SELECT COUNT(*) FROM dbo.Mensaje) messages, (SELECT COUNT(*) FROM dbo.Lead) leads',
      )
    ).recordset[0];
    assert.deepEqual(after, before);
  } finally {
    await close();
  }
});

test('HTTP: configuración privada y simulación validadas', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base + '/api/agent/recommendations/settings')).status, 401);
    const request = await loginAdmin(base);
    const settings = await (await request(base + '/api/agent/recommendations/settings')).json();
    assert.equal(settings.minimum, 50);
    const response = await request(base + '/api/agent/recommendations/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profile, simulation: true }),
    });
    assert.equal(response.status, 200);
    assert.match((await response.json()).text, /^EJEMPLO SIMULADO/);
    const invalid = await request(base + '/api/agent/recommendations/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profile, budget: -1, simulation: true }),
    });
    assert.equal(invalid.status, 400);
    if (!settings.eligible)
      assert.equal(
        (
          await request(base + '/api/agent/recommendations/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true, version: settings.version }),
          })
        ).status,
        409,
      );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await close();
  }
});
