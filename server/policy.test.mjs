import assert from 'node:assert/strict';
import test from 'node:test';
import { priorityFor } from './policy.mjs';
test('el contador prevalece sobre intención de compra', () => {
  assert.equal(priorityFor(3, 7).priority, 5);
  assert.equal(priorityFor(3, 3).priority, 4);
  assert.equal(priorityFor(3, 2).priority, 2);
});
test('Consulta sobre precio es Media; Ninguno es Baja', () => {
  assert.equal(priorityFor(2, 0).priority, 3);
  assert.equal(priorityFor(1, 0).priority, 4);
});
test('umbrales configurables y seis intentos aún son Baja', () => {
  assert.equal(priorityFor(3, 6).priority, 4);
  assert.equal(priorityFor(3, 2, 2, 5).priority, 4);
  assert.equal(priorityFor(3, 5, 2, 5).priority, 5);
});
