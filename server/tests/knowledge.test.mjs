import assert from 'node:assert/strict';
import test from 'node:test';
import { answerFromKnowledge, retrieve } from '../agent/knowledge.mjs';
import { handoffReason } from '../agent/service.mjs';
import { initialDocuments } from '../knowledge/initial.mjs';

const tariffs = [
  { idPlanTarifa: 1, plan: 'Ruta UNT', modalidad: 'Mensual', precio: 39.9 },
  { idPlanTarifa: 2, plan: 'Meta UNT', modalidad: 'Mensual', precio: 79.9 },
  { idPlanTarifa: 3, plan: 'Meta UNT', modalidad: 'Semestral', precio: 399.9 },
];

test('la respuesta sale de los fragmentos recuperados y conserva su fuente', () => {
  const documents = initialDocuments(tariffs).map((item, index) => ({
    documentId: index + 1,
    position: 1,
    version: 1,
    ...item,
  }));
  const live = answerFromKnowledge('¿Tienen clases en vivo?', tariffs, documents);
  assert.match(live.text, /Transmisiones académicas en vivo[\s\S]*Meta UNT: Sí/);
  assert.match(live.sources[0].source, /PlanTarifa.*offer\.json.*documento/);
  const price = answerFromKnowledge('cuanto cuesta meta', tariffs, documents);
  assert.match(price.text, /79\.90/);
  assert.match(price.sources[0].id, /^documento:/);
  assert.equal(answerFromKnowledge('Hola', tariffs), null);
  assert.equal(retrieve('Mi hija se llama Carolina', tariffs).length, 0);
});

test('motivos de derivación por palabras completas', () => {
  assert.equal(handoffReason('¿Me puede atender un asesor humano?'), 1);
  assert.equal(handoffReason('Pásenme con un asesor por favor'), 1);
  assert.equal(handoffReason('Quiero que me devuelvan mi dinero'), 3);
  assert.equal(handoffReason('Hice el pago ayer y no me confirman'), 5);
  assert.equal(handoffReason('Esto es una estafa'), 2);
  assert.equal(handoffReason('¿Qué medios de pago aceptan?'), null);
  assert.equal(handoffReason('Yo mismo pago, trabajo'), null);
});
