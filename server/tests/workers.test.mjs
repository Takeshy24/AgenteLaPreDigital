import assert from 'node:assert/strict';
import test from 'node:test';
import { runWorkerCycle } from '../workers.mjs';

test('un fallo de Telegram o mantenimiento permite procesar WhatsApp y despachar respuestas', async () => {
  const completed = [];
  const failures = [];
  await runWorkerCycle({
    telegram: async () => {
      throw new Error('Telegram no responde');
    },
    whatsapp: async () => completed.push('WhatsApp'),
    maintenance: async () => {
      throw new Error('Error SQL');
    },
    dispatch: async () => completed.push('envíos'),
    reportError: (name, error) => failures.push([name, error.message]),
  });
  assert.deepEqual(completed, ['WhatsApp', 'envíos']);
  assert.deepEqual(failures, [
    ['Telegram', 'Telegram no responde'],
    ['mantenimiento', 'Error SQL'],
  ]);
});
