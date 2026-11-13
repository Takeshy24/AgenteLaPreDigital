import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizePlan } from '../agent/plan-summary.mjs';
import { answerFromKnowledge } from '../agent/knowledge.mjs';
import { initialDocuments } from '../knowledge/initial.mjs';

test('resume el documento real con precio mensual y tres beneficios, sin la ficha completa', () => {
  const documents = initialDocuments([
    { plan: 'Ruta UNT', modalidad: 'Mensual', precio: 39.9 },
    { plan: 'Meta UNT', modalidad: 'Mensual', precio: 79.9 },
    { plan: 'Meta UNT', modalidad: 'Semestral', precio: 399.9 },
  ]).map((item, index) => ({ documentId: index + 1, position: 1, version: 1, ...item }));
  const answer = answerFromKnowledge('Qué incluye Ruta UNT', [], documents);
  const text = summarizePlan(answer.text, 'Ruta UNT');
  assert.match(text, /Mensual: S\/ 39\.90/);
  assert.match(text, /Videoclases y materiales/);
  assert.match(text, /Ejercicios por curso y tema/);
  assert.match(text, /Simulacros completos: 3 por semana/);
  assert.equal(text.split('\n').filter((line) => line.startsWith('•')).length, 3);
  assert.doesNotMatch(text, /No incluido|Descarga|soporte|Meta UNT|Semestral/);
  assert.ok(text.length <= 320);
});

test('respeta los valores editados y no convierte una exclusión en un beneficio', () => {
  const text = summarizePlan(
    'Ruta UNT\nMensual: S/ 42.50 · Semestral: S/ 250.00.\nVideoclases y materiales: No incluido.\nEjercicios por curso y tema: Sí.\nSimulacros completos: 1 por semana.\nRuta de estudio: Estándar.',
    'Ruta UNT',
  );
  assert.match(text, /42\.50/);
  assert.match(text, /Simulacros completos: 1 por semana/);
  assert.doesNotMatch(text, /39\.90|250\.00|Videoclases/);
  assert.equal(summarizePlan('', 'Ruta UNT'), '');
  assert.equal(summarizePlan('Meta UNT: S/ 79.90.', 'Ruta UNT'), '');
});

test('conserva las condiciones de la prueba gratuita y permite reducir las alternativas', () => {
  assert.match(
    summarizePlan(
      'Explora UNT\nPrueba gratuita de 14 días, una vez por estudiante.',
      'Explora UNT',
    ),
    /14 días, una vez por estudiante/,
  );
  const text = summarizePlan(
    'Mensual: S/ 79.90.\nVideoclases y materiales: Sí.\nEjercicios por curso y tema: Sí.',
    'Meta UNT',
    { benefits: 1, limit: 100 },
  );
  assert.equal(text.split('\n').filter((line) => line.startsWith('•')).length, 1);
});
