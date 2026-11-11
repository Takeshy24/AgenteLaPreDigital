import assert from 'node:assert/strict';
import test from 'node:test';
import { applyIntentRules, extractGuardian, resolveTariff } from '../agent/intents.mjs';

const tariffs = [
  { idPlanTarifa: 1, plan: 'Ruta UNT', modalidad: 'Mensual' },
  { idPlanTarifa: 2, plan: 'Meta UNT', modalidad: 'Mensual' },
  { idPlanTarifa: 3, plan: 'Meta UNT', modalidad: 'Semestral' },
  { idPlanTarifa: 4, plan: 'Meta UNT Plus', modalidad: 'Mensual' },
  { idPlanTarifa: 5, plan: 'Meta UNT Plus', modalidad: 'Semestral' },
];
const base = () => ({
  level: 1,
  retraction: false,
  action: 'ask',
  tariffId: 9,
  fields: [],
  understood: false,
  needsGuardian: false,
  guardian: null,
});

test('la tarifa sale del plan y la modalidad escritos; sin modalidad en un plan con dos, queda pendiente', () => {
  assert.equal(resolveTariff('quiero meta unt plus semestral', tariffs), 5);
  assert.equal(resolveTariff('Quiero Meta UNT mensual', tariffs), 2);
  assert.equal(resolveTariff('quiero ruta unt', tariffs), 1);
  assert.equal(resolveTariff('quiero meta unt', tariffs), null);
  assert.equal(resolveTariff('quiero un plan', tariffs), null);
});

test('pedir pagar o contratar prepara propuesta con nivel Compra', () => {
  const result = applyIntentRules(base(), 'Quiero pagar ya el plan Meta UNT mensual', tariffs);
  assert.deepEqual(
    [result.action, result.level, result.tariffId, result.understood],
    ['proposal', 3, 2, true],
  );
  assert.equal(applyIntentRules(base(), '¿Qué incluye Meta UNT?', tariffs).action, 'catalog');
  assert.equal(applyIntentRules(base(), 'Ya no quiero contratar, gracias', tariffs).action, 'ask');
});

test('Explora, objeciones y responsable económico se reconocen por regla', () => {
  assert.equal(applyIntentRules(base(), 'Quiero probar Explora gratis', tariffs).action, 'trial');
  const objection = applyIntentRules(base(), 'Me parece caro', tariffs);
  assert.deepEqual([objection.action, objection.level], ['catalog', 2]);
  assert.equal(applyIntentRules(base(), 'Mi papá es quien paga', tariffs).needsGuardian, true);
  assert.equal(applyIntentRules(base(), 'Quiero estudiar medicina', tariffs).needsGuardian, false);
});

test('los datos del responsable se extraen solo si hay nombre, relación y teléfono +51', () => {
  assert.deepEqual(extractGuardian('Mi mamá se llama Rosa Díaz, su teléfono es +51 987 654 321'), {
    name: 'Rosa Díaz',
    phone: '+51987654321',
    role: 3,
    quote: 'Mi mamá se llama Rosa Díaz, su teléfono es +51 987 654 321',
  });
  assert.equal(extractGuardian('Mi mamá se llama Rosa Díaz'), null);
  assert.equal(extractGuardian('Se llama Rosa Díaz, +51 987 654 321'), null);
});

test('palabras completas: «Carolina» no es objeción y una carrera sin pista no se acepta', () => {
  const carolina = applyIntentRules(
    { ...base(), fields: [{ field: 'career', value: 'Carolina', quote: 'Carolina' }] },
    'Mi hija se llama Carolina',
    tariffs,
  );
  assert.equal(carolina.action, 'ask');
  assert.deepEqual(carolina.fields, []);
  const extracted = applyIntentRules(
    base(),
    'Postulo a Arquitectura y estudio 3 horas al día con 80 soles',
    tariffs,
  );
  assert.deepEqual(Object.fromEntries(extracted.fields.map((item) => [item.field, item.value])), {
    career: 'Arquitectura',
    availability: '3 horas al día',
    budget: '80',
  });
});

test('preguntas de pago son Compra y el contexto resuelve «sí, el mensual»', () => {
  const payment = applyIntentRules(base(), '¿Qué medios de pago aceptan?', tariffs);
  assert.deepEqual([payment.action, payment.level], ['catalog', 3]);
  const context = { requestedPlan: { plan: 'Meta UNT' } };
  const yes = applyIntentRules(base(), 'sí, el mensual', tariffs, context);
  assert.deepEqual([yes.action, yes.tariffId, yes.level], ['proposal', 2, 3]);
});
