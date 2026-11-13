import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isNoContactRequest,
  isResumeContactRequest,
  isUnsubscribeQuestion,
  noContactChannels,
} from '../agent/consent-prompt.mjs';
import { handoffReason } from '../agent/service.mjs';
import { declinesFamilyContact, needsGuardianText } from '../agent/intents.mjs';

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
    'Retiro mi autorización para recibir mensajes',
    'Quiero darme de baja, ya no me envíen nada',
    'No quiero volver a recibir mensajes',
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

test('la revocación se limita a los canales que nombra la persona', () => {
  assert.deepEqual(noContactChannels('No me escriban más por favor'), [1, 2, 3]);
  assert.deepEqual(noContactChannels('Ya no me escriban por WhatsApp, solo por correo'), [1]);
  assert.deepEqual(noContactChannels('No me escriban por correo ni por Telegram'), [2, 3]);
  assert.deepEqual(noContactChannels('No me escriban, solo por correo'), [1, 3]);
});

test('volver a recibir mensajes se reconoce sin confundirlo con su negación', () => {
  for (const text of ['Quiero volver a recibir mensajes', 'Ya pueden escribirme otra vez'])
    assert.equal(isResumeContactRequest(text), true, text);
  for (const text of ['No quiero volver a recibir mensajes', 'Te escribo yo después'])
    assert.equal(isResumeContactRequest(text), false, text);
});

test('los pedidos de devolución se derivan por reembolso', () => {
  for (const text of [
    '¿Me pueden devolver la plata?',
    'Quiero cancelar y que me regresen lo que pagué',
    'Si no me gusta, ¿me devuelven el dinero?',
    'Devuélvanme el pago',
  ])
    assert.equal(handoffReason(text), 3, text);
  for (const text of ['Quiero regresar a estudiar', '¿Me devuelven el cambio en efectivo?'])
    assert.equal(handoffReason(text), null, text);
});

test('pedir que no escriban a un familiar no lo invita', () => {
  const text = 'No le escriban a mi mamá, ella no decide';
  assert.equal(declinesFamilyContact(text), true);
  assert.equal(needsGuardianText(text), false);
  assert.equal(needsGuardianText('Quiero que le escriban a mi mamá'), true);
});

test('preguntar cómo darse de baja es una consulta y no revoca', () => {
  for (const text of [
    '¿Cómo me doy de baja?',
    '¿Puedo pedir que no me escriban?',
    '¿Cómo dejo de recibir mensajes?',
  ]) {
    assert.equal(isNoContactRequest(text), false, text);
    assert.equal(isUnsubscribeQuestion(text), true, text);
  }
  assert.equal(isNoContactRequest('Quiero darme de baja'), true);
  assert.equal(isUnsubscribeQuestion('Quiero darme de baja'), false);
});
