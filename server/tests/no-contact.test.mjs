import assert from 'node:assert/strict';
import test from 'node:test';
import { isNoContactRequest } from '../agent/consent-prompt.mjs';

test('la petición de no contacto se reconoce sin depender del modelo', () => {
  for (const text of [
    'ya no quiero que me contacten, no los quiero',
    'No quiero que me escriban más',
    'No deseo que me contacten',
    'No quiero que me llamen',
    'No me contacten más',
    'Ya no me escriban, por favor',
    'Dejen de escribirme',
    'Deja de contactarme',
    'No quiero recibir más mensajes',
    'Ya no deseo recibir publicidad',
    'No me vuelvan a contactar',
    'Por favor no me envíen más mensajes',
    'STOP',
  ]) {
    assert.equal(isNoContactRequest(text), true, text);
  }
});

test('rechazar un plan o mantener el contacto no revoca la autorización', () => {
  for (const text of [
    'No quiero Meta UNT Plus, prefiero Ruta UNT',
    'No quiero contratar por ahora',
    'Ya no me interesa esa propuesta',
    'No quiero que me cambien el plan',
    'No quiero dejar de recibir mensajes',
    'No quiero que dejen de escribirme',
    'Quiero que me contacten',
    'No quiero recibir una beca',
  ]) {
    assert.equal(isNoContactRequest(text), false, text);
  }
});
