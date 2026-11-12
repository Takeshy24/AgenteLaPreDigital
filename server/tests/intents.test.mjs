import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyIntentRules,
  extractGuardian,
  guardianFrom,
  needsGuardianText,
  resolveTariff,
} from '../agent/intents.mjs';
import { validateAnalysis } from '../agent/ollama.mjs';

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

test('datos del responsable en texto libre: sin +51, en minúsculas, por partes y otros familiares', async () => {
  const { guardianParts, guardianFrom } = await import('../agent/intents.mjs');
  assert.deepEqual(guardianParts('Se llama Rosa Díaz Pérez y su celular es 987654321'), {
    name: 'Rosa Díaz Pérez',
    phone: '+51987654321',
    role: null,
  });
  assert.deepEqual(guardianParts('se llama rosa diaz, cel 987654321').name, 'Rosa Diaz');
  assert.deepEqual(
    guardianParts('Mi tía Carmen López es la que me paga, su número es 999 888 777'),
    { name: 'Carmen López', phone: '+51999888777', role: 4 },
  );
  assert.equal(
    guardianParts('Mi mamá María de los Ángeles Torres, 51987654321').name,
    'María de los Ángeles Torres',
  );
  assert.deepEqual(
    guardianFrom(['Mi papá es el que decide', 'Se llama Carlos Ruiz', 'Su número es 912 345 678']),
    { name: 'Carlos Ruiz', phone: '+51912345678', role: 2 },
  );
  for (const text of ['Tengo 80 soles al mes', 'Mi hija se llama Carolina', 'Quiero Meta UNT'])
    assert.deepEqual(guardianParts(text), { name: null, phone: null, role: null }, text);
});

test('pedir la invitación para la esposa o pareja activa la vinculación, aunque el modelo la omita', () => {
  for (const text of [
    'Hola quiero enviarle el link de invitación a mi esposa',
    'Quiero invitar a mi esposo',
    '¿Puedes preparar la invitación para mi pareja?',
    'Mi esposa es quien paga',
  ]) {
    const analysis = validateAnalysis(base(), text, tariffs);
    assert.equal(analysis.needsGuardian, true, text);
  }
  assert.deepEqual(
    guardianFrom([
      'Hola quiero enviarle el link de invitación a mi esposa',
      'Se llama Patricia Pérez',
      'Su celular es 912345678',
    ]),
    { name: 'Patricia Pérez', phone: '+51912345678', role: 4 },
  );
});

test('mencionar a la esposa o rechazar la invitación no declara una necesidad de vinculación', () => {
  for (const text of [
    'Mi esposa estudia Medicina',
    'No quiero invitar a mi esposa',
    'No le envíes la invitación a mi esposa',
    '¿Qué es una invitación?',
    'Mi esposa recibió el link de invitación',
  ]) {
    assert.equal(needsGuardianText(text), false, text);
  }
});
