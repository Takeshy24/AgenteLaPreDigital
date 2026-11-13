import assert from 'node:assert/strict';
import test from 'node:test';
import { applyIntentRules, resolveTariff } from '../agent/intents.mjs';
import { validateAnalysis } from '../agent/ollama.mjs';
import { answerFromKnowledge } from '../agent/knowledge.mjs';
import { initialDocuments } from '../knowledge/initial.mjs';

const tariffs = [
  { idPlanTarifa: 1, plan: 'Ruta UNT', modalidad: 'Mensual', precio: 39.9 },
  { idPlanTarifa: 2, plan: 'Meta UNT', modalidad: 'Mensual', precio: 79.9 },
  { idPlanTarifa: 3, plan: 'Meta UNT', modalidad: 'Semestral', precio: 399.9 },
  { idPlanTarifa: 4, plan: 'Meta UNT Plus', modalidad: 'Mensual', precio: 99.9 },
  { idPlanTarifa: 5, plan: 'Meta UNT Plus', modalidad: 'Semestral', precio: 499.9 },
];
const base = () => ({
  level: 1,
  retraction: false,
  action: 'ask',
  tariffId: null,
  fields: [],
  understood: true,
  needsGuardian: false,
  guardian: null,
});
const previousPlus = {
  requestedPlan: { plan: 'Meta UNT Plus', period: 'Mensual' },
  history: [
    { direction: 1, text: 'Tengo 100 soles al mes' },
    {
      direction: 2,
      text: 'Te recomiendo Meta UNT Plus mensual. También puedes probar Explora UNT.',
    },
  ],
};

test('pedido de la captura: Ruta UNT mensual prevalece sobre el formulario y la recomendación Plus', () => {
  for (const action of ['ask', 'catalog', 'proposal']) {
    const result = validateAnalysis(
      { ...base(), action, tariffId: 4 },
      'quiero ruta unt mensual porfavoooor :)',
      tariffs,
      previousPlus,
    );
    assert.deepEqual([result.action, result.tariffId, result.level], ['proposal', 1, 3]);
  }
});

test('corregir el plan no es rechazar toda la compra ni seleccionar la alternativa negada', () => {
  for (const text of [
    'pero yo quiero ruta unt, no meta unt plus por favor',
    'No quiero Meta UNT Plus, prefiero Ruta UNT mensual',
    'Prefiero Ruta UNT en vez de Meta UNT Plus',
  ]) {
    const result = validateAnalysis(
      { ...base(), retraction: true, action: 'proposal', tariffId: 4 },
      text,
      tariffs,
      previousPlus,
    );
    assert.deepEqual(
      [result.action, result.tariffId, result.retraction],
      ['proposal', 1, false],
      text,
    );
  }
});

test('un plan explícito no se sustituye por otro al faltar una modalidad o no existir la pedida', () => {
  const context = { requestedPlan: { plan: 'Meta UNT Plus', period: 'Mensual' } };
  for (const [text, expected] of [
    ['Quiero contratar Ruta UNT semestral', null],
    ['Quiero contratar Meta UNT', null],
    ['Quiero contratar Meta UNT semestral', 3],
    ['Quiero contratar Meta UNT Plus mensual', 4],
    ['Quiero contratar Ruta UNT o Meta UNT mensual', null],
    ['Quiero contratar Meta UNT mensual o semestral', null],
  ]) {
    const result = applyIntentRules(base(), text, tariffs, context);
    assert.deepEqual([result.action, result.tariffId], ['proposal', expected], text);
  }
});

test('el último plan del contacto prevalece sobre el formulario y sobre sugerencias del agente', () => {
  const context = {
    ...previousPlus,
    history: [
      { direction: 1, text: 'Quiero Meta UNT semestral' },
      { direction: 2, text: 'También tenemos Meta UNT Plus mensual' },
    ],
  };
  const result = validateAnalysis(base(), 'sí, el mensual', tariffs, context);
  assert.deepEqual([result.action, result.tariffId], ['proposal', 2]);
  assert.equal(resolveTariff('Quiero la propuesta', tariffs, context), 3);
});

test('una confirmación abreviada no elige por longitud entre varios planes del catálogo', () => {
  for (const history of [
    [{ direction: 2, text: 'Ruta UNT, Meta UNT y Meta UNT Plus: elige tu plan.' }],
    [{ direction: 1, text: 'Quiero Ruta UNT o Meta UNT, todavía no sé cuál.' }],
    [{ direction: 1, text: 'No quiero Meta UNT Plus' }],
  ]) {
    assert.equal(resolveTariff('sí, el mensual', tariffs, { history }), null);
  }
  assert.equal(resolveTariff('sí, el mensual', tariffs, previousPlus), 4);
});

test('la consulta de beneficios omite el plan negado y conserva el plan solicitado', () => {
  const text = 'Quiero saber qué incluye Ruta UNT, no Meta UNT Plus';
  const result = validateAnalysis(base(), text, tariffs, previousPlus);
  assert.equal(result.action, 'catalog');
  const documents = initialDocuments(tariffs).map((item, index) => ({
    ...item,
    documentId: index + 1,
    position: 1,
    version: 1,
  }));
  const answer = answerFromKnowledge(text, tariffs, documents);
  assert.match(answer.text, /^Ruta UNT\nMensual: S\/ 39\.90/);
  assert.doesNotMatch(answer.text, /Meta UNT/);
});
