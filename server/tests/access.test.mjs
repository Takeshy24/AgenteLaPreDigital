import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { openMessage, sealMessage, verifyPassword } from '../access/crypto.mjs';
import {
  acceptTerms,
  activateService,
  paymentIncident,
  recordPayment,
  retryAccessDelivery,
  validateContract,
} from '../contracts/service.mjs';
import { close, query, rollbackTest } from '../db.mjs';
import { saveConsent } from '../consents/service.mjs';
import { dispatchMessage } from '../integrations/dispatch.mjs';
import { markDelivered, markSent } from '../integrations/repository.mjs';
import { createLead } from '../leads/service.mjs';
import { recordIncoming } from '../messages/service.mjs';
import { confirmExternalDelivery } from '../messages/delivery.mjs';
import { listPending } from '../pending/service.mjs';
import { prepareProposal, recordProposalResponse } from '../proposals/service.mjs';
import { getParticipation } from '../shared/repository.mjs';
import { getDetails } from '../workspace/repository.mjs';

test.beforeEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.SMTP_USER = 'access@example.test';
  process.env.SMTP_PASSWORD = 'test-only';
  process.env.TELEGRAM_ENABLED = 'true';
  process.env.TELEGRAM_BOT_TOKEN = 'test-only';
  process.env.WHATSAPP_ENABLED = 'true';
  process.env.WHATSAPP_TOKEN = 'test-only';
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-only';
  process.env.WHATSAPP_CREDENTIALS_TEMPLATE_NAME = '';
});
test.after(async () => close());

async function contract(
  db,
  { channel = 2, acceptChannel = channel, identity, validate = true, role = 1, beneficiaryId } = {},
) {
  const suffix = randomUUID();
  const person = identity || {
    name: `Acceso ${suffix}`,
    email: `${suffix}@example.test`,
    phone: '+51987654321',
  };
  const lead = await createLead({
    ...person,
    role,
    beneficiaryId,
    channel: 1,
    communicationChannel: channel,
    consent: true,
  });
  const participation = await getParticipation(db, lead.id);
  if (channel === 3)
    await query(
      db,
      `INSERT dbo.App_TelegramChat (idContacto, chatId)
VALUES (@contact, @chat)`,
      { contact: participation.idContacto, chat: suffix.slice(0, 20) },
    );
  const incoming = await recordIncoming(lead.id, {
    channel,
    text: 'Quiero contratar este plan.',
    level: 3,
  });
  const tariff = (await query(db, 'SELECT TOP 1 * FROM dbo.PlanTarifa ORDER BY idPlanTarifa'))
    .recordset[0];
  const proposal = await prepareProposal(lead.id, {
    tariff: tariff.idPlanTarifa,
    replyTo: incoming.id,
    channel,
    justification: 'Plan elegido para prueba de acceso.',
  });
  await query(db, "INSERT dbo.App_Dispatch(idMensaje,state) VALUES(@id,N'pending')", {
    id: proposal.messageId,
  });
  await markSent(db, proposal.messageId, 'proposal-test-' + suffix);
  const accepted = await recordIncoming(lead.id, {
    channel: acceptChannel,
    text: 'Acepto la propuesta y sus condiciones.',
    level: 3,
  });
  await recordProposalResponse(proposal.id, { messageId: accepted.id, result: 1 });
  const caseId = participation.idCaso;
  await acceptTerms(caseId, {
    proposalId: proposal.id,
    reference: 'Aceptación de condiciones para prueba.',
  });
  await recordPayment(caseId, { amount: Number(tariff.precio), reference: 'payment-' + suffix });
  if (validate) await validateContract(caseId);
  return { lead, participation, caseId, person };
}

async function account(db, caseId) {
  return (
    await query(
      db,
      `SELECT u.*, a.idMensajeCredenciales, a.mensajeCifrado,
    a.idCanalEntrega, a.idContactoEntrega, a.idContratacion, k.fechaHabilitacion,
    m.textoMensaje, m.idEstadoEntrega, d.state dispatchState, d.error
  FROM dbo.HabilitacionAcceso a
  JOIN dbo.UsuarioPlataforma u ON u.idUsuario=a.idUsuario
  JOIN dbo.Contratacion k ON k.idContratacion=a.idContratacion
  JOIN dbo.Mensaje m ON m.idMensaje=a.idMensajeCredenciales
  LEFT JOIN dbo.App_Dispatch d ON d.idMensaje=m.idMensaje
  WHERE k.idCaso=@caseId`,
      { caseId },
    )
  ).recordset[0];
}

test('habilitar crea una cuenta, cifra el envío y correo entrega una sola vez sin exponer la clave', async () => {
  await rollbackTest(async (db) => {
    const flow = await contract(db);
    await activateService(flow.caseId);
    await activateService(flow.caseId);
    const saved = await account(db, flow.caseId);
    const plaintext = openMessage(saved.mensajeCifrado, saved.idContratacion);
    const password = plaintext.match(/Clave provisional: (\S+)/)[1];
    assert.ok(await verifyPassword(password, saved.claveHash));
    assert.equal(await verifyPassword('clave incorrecta', saved.claveHash), false);
    assert.equal(saved.claveHash.includes(password), false);
    assert.equal(saved.mensajeCifrado.includes(password), false);
    assert.equal(saved.textoMensaje.includes(password), false);
    const details = await getDetails(flow.lead.id);
    assert.equal(details.access[0].delivery, 'Pendiente');
    assert.equal(JSON.stringify(details).includes(password), false);
    assert.equal(JSON.stringify(details).includes(saved.claveHash), false);
    assert.equal(JSON.stringify(details).includes(saved.mensajeCifrado), false);
    assert.equal(
      (
        await query(db, 'SELECT COUNT(*) n FROM dbo.UsuarioPlataforma WHERE idBeneficiario=@id', {
          id: flow.participation.idBeneficiario,
        })
      ).recordset[0].n,
      1,
    );
    assert.equal(
      (
        await query(
          db,
          'SELECT COUNT(*) n FROM dbo.EventoCaso WHERE idCaso=@id AND idTipoEvento=14',
          { id: flow.caseId },
        )
      ).recordset[0].n,
      1,
    );
    assert.ok(
      (await listPending()).some(
        (item) => item.type === 'access-delivery' && item.caseId === flow.caseId,
      ),
    );
    await assert.rejects(
      () =>
        confirmExternalDelivery(saved.idMensajeCredenciales, {
          reference: 'No sustituye al adaptador.',
        }),
      /adaptador/,
    );
    const sent = [];
    const mail = {
      send: async (message) => {
        sent.push(message);
        return { messageId: 'smtp-test' };
      },
    };
    assert.equal((await dispatchMessage(saved.idMensajeCredenciales, null, { mail })).sent, true);
    assert.equal(sent[0].to, flow.person.email);
    assert.ok(sent[0].text.includes(password));
    const delivered = await account(db, flow.caseId);
    assert.equal(delivered.idEstadoEntrega, 2);
    assert.equal(delivered.mensajeCifrado, null);
    assert.equal((await dispatchMessage(saved.idMensajeCredenciales, null, { mail })).sent, false);
    assert.equal(sent.length, 1);
    assert.equal(
      (await listPending()).some(
        (item) => item.type === 'access-delivery' && item.caseId === flow.caseId,
      ),
      false,
    );
  });
});

test('aceptar en portal conserva Telegram como canal; una entrega incierta no se reenvía', async () => {
  await rollbackTest(async (db) => {
    const flow = await contract(db, { channel: 3, acceptChannel: 4 });
    await activateService(flow.caseId);
    const saved = await account(db, flow.caseId);
    assert.equal(saved.idCanalEntrega, 3);
    assert.equal(saved.idContactoEntrega, flow.participation.idContacto);
    let attempts = 0;
    const client = {
      call: async () => {
        attempts++;
        const error = new Error('Respuesta de red desconocida');
        error.uncertain = true;
        throw error;
      },
    };
    assert.equal((await dispatchMessage(saved.idMensajeCredenciales, client)).uncertain, true);
    await assert.rejects(() => retryAccessDelivery(flow.caseId), /incierta/);
    assert.equal((await dispatchMessage(saved.idMensajeCredenciales, client)).sent, false);
    assert.equal(attempts, 1);
    assert.equal((await account(db, flow.caseId)).dispatchState, 'unknown');
  });
});

test('WhatsApp recibe las credenciales; aceptación de envío no equivale a entrega', async () => {
  await rollbackTest(async (db) => {
    const flow = await contract(db, { channel: 1, acceptChannel: 4 });
    await activateService(flow.caseId);
    const saved = await account(db, flow.caseId);
    const sent = [];
    const whatsapp = {
      send: async (payload) => {
        sent.push(payload);
        return 'wamid.access-test';
      },
    };
    await dispatchMessage(saved.idMensajeCredenciales, null, { whatsapp });
    assert.equal(sent[0].type, 'text');
    assert.match(sent[0].text.body, /Clave provisional:/);
    assert.equal((await account(db, flow.caseId)).idEstadoEntrega, 1);
    assert.ok((await account(db, flow.caseId)).mensajeCifrado);
    await markDelivered(db, saved.idMensajeCredenciales);
    assert.equal((await account(db, flow.caseId)).idEstadoEntrega, 2);
    assert.equal((await account(db, flow.caseId)).mensajeCifrado, null);
  });
});

test('no habilita sin validación, con reembolso o con canal sin configurar', async () => {
  await rollbackTest(async (db) => {
    const flow = await contract(db, { validate: false });
    await assert.rejects(() => activateService(flow.caseId), /no validada/);
    await validateContract(flow.caseId);
    process.env.SMTP_PASSWORD = '';
    await assert.rejects(() => activateService(flow.caseId), /SMTP/);
    assert.equal(await account(db, flow.caseId), undefined);
    assert.equal(
      (
        await query(db, 'SELECT fechaHabilitacion FROM dbo.Contratacion WHERE idCaso=@id', {
          id: flow.caseId,
        })
      ).recordset[0].fechaHabilitacion,
      null,
    );
    process.env.SMTP_PASSWORD = 'test-only';
    await paymentIncident(flow.caseId, {
      type: 'refund',
      reference: 'Devolución total de prueba.',
    });
    await assert.rejects(() => activateService(flow.caseId), /invalidada/);
    assert.equal(await account(db, flow.caseId), undefined);
  });
});

test('la revocación frena la entrega; un reintento autorizado conserva cuenta y contraseña', async () => {
  await rollbackTest(async (db) => {
    const flow = await contract(db);
    await activateService(flow.caseId);
    const saved = await account(db, flow.caseId);
    await saveConsent(flow.lead.id, { channel: 2, granted: false, version: 'access-test' });
    let attempts = 0;
    const mail = {
      send: async () => {
        attempts++;
        return { messageId: 'smtp-retry-test' };
      },
    };
    assert.equal((await dispatchMessage(saved.idMensajeCredenciales, null, { mail })).sent, false);
    assert.equal(attempts, 0);
    assert.equal((await account(db, flow.caseId)).idEstadoEntrega, 3);
    await saveConsent(flow.lead.id, { channel: 2, granted: true, version: 'access-test' });
    await retryAccessDelivery(flow.caseId);
    const retried = await account(db, flow.caseId);
    assert.equal(retried.idUsuario, saved.idUsuario);
    assert.equal(retried.claveHash, saved.claveHash);
    assert.notEqual(retried.idMensajeCredenciales, saved.idMensajeCredenciales);
    assert.equal((await dispatchMessage(retried.idMensajeCredenciales, null, { mail })).sent, true);
    assert.equal(attempts, 1);
  });
});

test('una negociación posterior reutiliza la cuenta y no cambia su contraseña', async () => {
  await rollbackTest(async (db) => {
    const flow = await contract(db);
    await activateService(flow.caseId);
    const first = await account(db, flow.caseId);
    const later = await contract(db, { identity: flow.person });
    assert.notEqual(later.caseId, flow.caseId);
    await activateService(later.caseId);
    const second = await account(db, later.caseId);
    assert.equal(second.idUsuario, first.idUsuario);
    assert.equal(second.claveHash, first.claveHash);
    const text = openMessage(second.mensajeCifrado, second.idContratacion);
    assert.match(text, /Conserva tu contraseña actual/);
    assert.equal(text.includes('Clave provisional:'), false);
  });
});

test('WhatsApp fuera de ventana exige una plantilla específica, nunca hello_world', async () => {
  await rollbackTest(async (db) => {
    const flow = await contract(db, { channel: 1 });
    await query(
      db,
      'UPDATE dbo.Mensaje SET fechaHora=DATEADD(DAY,-2,DATEADD(HOUR,-5,SYSUTCDATETIME())) WHERE idContacto=@contact AND idDireccion=1 AND idCanal=1',
      { contact: flow.participation.idContacto },
    );
    await assert.rejects(() => activateService(flow.caseId), /plantilla/);
    process.env.WHATSAPP_CREDENTIALS_TEMPLATE_NAME = 'hello_world';
    await assert.rejects(() => activateService(flow.caseId), /plantilla/);
    process.env.WHATSAPP_CREDENTIALS_TEMPLATE_NAME = 'credenciales_de_prueba';
    await activateService(flow.caseId);
    const saved = await account(db, flow.caseId);
    let sent;
    await dispatchMessage(saved.idMensajeCredenciales, null, {
      whatsapp: {
        send: async (payload) => {
          sent = payload;
          return 'wamid.template-test';
        },
      },
    });
    assert.equal(sent.template.name, 'credenciales_de_prueba');
    assert.match(sent.template.components[0].parameters[0].text, /Clave provisional:/);
  });
});

test('la cuenta pertenece al estudiante y las credenciales llegan al responsable que contrató', async () => {
  await rollbackTest(async (db) => {
    const suffix = randomUUID();
    const student = await createLead({
      name: `Estudiante ${suffix}`,
      email: `student-${suffix}@example.test`,
      phone: '+51987654321',
      role: 1,
      channel: 1,
      communicationChannel: 2,
      consent: true,
    });
    const context = await getParticipation(db, student.id);
    const parent = await contract(db, {
      channel: 3,
      acceptChannel: 4,
      role: 3,
      beneficiaryId: context.idBeneficiario,
      identity: {
        name: `Madre ${suffix}`,
        email: `parent-${suffix}@example.test`,
        phone: '+51987654322',
      },
    });
    assert.equal(parent.caseId, context.idCaso);
    await activateService(parent.caseId);
    const saved = await account(db, parent.caseId);
    assert.equal(saved.idBeneficiario, context.idBeneficiario);
    assert.equal(saved.idContactoEntrega, parent.participation.idContacto);
    assert.notEqual(saved.idContactoEntrega, context.idContacto);
    const chat = (
      await query(db, 'SELECT chatId FROM dbo.App_TelegramChat WHERE idContacto=@id', {
        id: parent.participation.idContacto,
      })
    ).recordset[0];
    let sent;
    await dispatchMessage(saved.idMensajeCredenciales, {
      call: async (_, payload) => {
        sent = payload;
        return { message_id: 77 };
      },
    });
    assert.equal(sent.chat_id, chat.chatId);
    assert.ok(sent.text.includes(`Usuario: ${saved.nombreUsuario}`));
    assert.equal((await account(db, parent.caseId)).idEstadoEntrega, 2);
  });
});

test('un rechazo de SMTP no filtra la clave y permite un reintento explícito', async () => {
  await rollbackTest(async (db) => {
    const flow = await contract(db);
    await activateService(flow.caseId);
    const saved = await account(db, flow.caseId);
    const plaintext = openMessage(saved.mensajeCifrado, saved.idContratacion);
    const password = plaintext.match(/Clave provisional: (\S+)/)[1];
    await dispatchMessage(saved.idMensajeCredenciales, null, {
      mail: {
        send: async () => {
          const error = new Error(`Fallo que contiene ${password}`);
          error.code = 'EAUTH';
          throw error;
        },
      },
    });
    const failed = await account(db, flow.caseId);
    assert.equal(failed.dispatchState, 'failed');
    assert.equal(failed.error.includes(password), false);
    assert.ok(
      (await listPending()).find(
        (item) => item.type === 'access-delivery' && item.caseId === flow.caseId,
      ).retryAllowed,
    );
    await retryAccessDelivery(flow.caseId);
    const retried = await account(db, flow.caseId);
    await dispatchMessage(retried.idMensajeCredenciales, null, {
      mail: { send: async () => ({ messageId: 'smtp-confirmed-retry' }) },
    });
    assert.equal((await account(db, flow.caseId)).mensajeCifrado, null);
  });
});

test('el mensaje cifrado rechaza cambios de contenido o de contratación', () => {
  const payload = sealMessage('contenido de prueba', 123);
  assert.equal(openMessage(payload, 123), 'contenido de prueba');
  assert.throws(() => openMessage(payload, 124));
  const parts = payload.split('.');
  const bytes = Buffer.from(parts[2], 'base64url');
  bytes[0] ^= 1;
  parts[2] = bytes.toString('base64url');
  assert.throws(() => openMessage(parts.join('.'), 123));
});
