import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { close, query, rollbackTest } from '../db.mjs';
import { reviewFollowup } from '../followup/service.mjs';
import { dispatchMessage } from '../integrations/dispatch.mjs';
import { acceptWhatsAppEvent } from '../integrations/repository.mjs';
import { whatsappClient } from '../integrations/whatsapp-client.mjs';
import { findWhatsAppContact, saveWhatsAppContact } from '../integrations/whatsapp-repository.mjs';
import {
  extractEvents,
  pollWhatsApp,
  receiveWebhook,
  verifyWebhookChallenge,
  verifyWhatsAppSignature,
} from '../integrations/whatsapp.mjs';
import { createLead } from '../leads/service.mjs';
import { saveConsent } from '../consents/service.mjs';
import { saveProfile } from '../profiles/service.mjs';

process.env.SMTP_PASSWORD = ''; // las pruebas nunca envían correo real
process.env.WHATSAPP_ENABLED = 'true';
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456';
process.env.WHATSAPP_APP_SECRET = 'secreto-de-prueba';
process.env.WHATSAPP_VERIFY_TOKEN = 'verificacion';

function fakeWhatsApp() {
  const calls = [];
  const client = {
    calls,
    send: async (payload) => {
      calls.push(payload);
      return `wamid.salida${calls.length}`;
    },
    sendText: async (to, text) => client.send({ to, type: 'text', text: { body: text } }),
  };
  return client;
}

async function setup({ role = 1, beneficiaryName } = {}) {
  const suffix = Date.now() + Math.floor(Math.random() * 1000);
  const phone = `+519${String(suffix).slice(-8)}`;
  const lead = await createLead({
    name: 'Estudiante WhatsApp ' + suffix,
    email: `wsp-${suffix}@example.test`,
    phone,
    role,
    beneficiaryName,
    channel: 1,
    communicationChannel: 1,
    consent: true,
  });
  return { lead, waId: phone.slice(1), client: fakeWhatsApp(), sequence: suffix };
}

async function receive(db, scenario, payload) {
  scenario.sequence += 1;
  await acceptWhatsAppEvent(db, {
    key: `m:wamid.entrada${scenario.sequence}`,
    kind: 'message',
    waId: scenario.waId,
    payload: { from: scenario.waId, id: `wamid.entrada${scenario.sequence}`, ...payload },
  });
  await pollWhatsApp(scenario.client);
}
const typed = (body) => ({ type: 'text', text: { body } });
const chosen = (id, title) => ({
  type: 'interactive',
  interactive: { type: 'list_reply', list_reply: { id, title } },
});

async function flush(db, scenario) {
  const pending = (
    await query(
      db,
      'SELECT idMensaje id FROM dbo.Mensaje WHERE idContacto=@contact AND idDireccion=2 AND idCanal=1 AND idEstadoEntrega=1 ORDER BY idMensaje',
      { contact: scenario.lead.contact },
    )
  ).recordset;
  for (const message of pending)
    await dispatchMessage(message.id, null, { whatsapp: scenario.client });
}

const incomingRows = async (db, scenario) =>
  (
    await query(
      db,
      'SELECT idCanal, textoMensaje text FROM dbo.Mensaje WHERE idContacto=@contact AND idDireccion=1 ORDER BY idMensaje',
      { contact: scenario.lead.contact },
    )
  ).recordset;

test('la firma del webhook se verifica con el secreto de la aplicación', () => {
  const body = Buffer.from('{"entry":[]}');
  const signature = 'sha256=' + createHmac('sha256', 'secreto').update(body).digest('hex');
  assert.equal(verifyWhatsAppSignature(body, signature, 'secreto'), true);
  assert.equal(verifyWhatsAppSignature(body, signature, 'otro'), false);
  assert.equal(verifyWhatsAppSignature(body, undefined, 'secreto'), false);
  assert.equal(verifyWhatsAppSignature(body, signature, ''), false);
});

test('el desafío de verificación exige modo suscripción y el token configurado', () => {
  const query = { 'hub.mode': 'subscribe', 'hub.verify_token': 'abc', 'hub.challenge': '777' };
  assert.equal(verifyWebhookChallenge(query, 'abc'), '777');
  assert.equal(verifyWebhookChallenge(query, 'otro'), null);
  assert.equal(verifyWebhookChallenge({ ...query, 'hub.mode': 'x' }, 'abc'), null);
  assert.equal(verifyWebhookChallenge(query, ''), null);
});

test('extractEvents separa mensajes y estados e ignora otros números de la cuenta', () => {
  const body = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: '123456' },
              messages: [{ id: 'm1', from: '51900000001', type: 'text', text: { body: 'hola' } }],
              statuses: [{ id: 'w1', status: 'delivered', recipient_id: '51900000001' }],
            },
          },
          {
            value: {
              metadata: { phone_number_id: '999' },
              messages: [{ id: 'm2', from: '51900000002' }],
            },
          },
        ],
      },
    ],
  };
  const events = extractEvents(body, '123456');
  assert.deepEqual(
    events.map((event) => event.key),
    ['m:m1', 's:w1:delivered'],
  );
});

test('un mismo evento reenviado por Meta se guarda una sola vez', async () => {
  try {
    await rollbackTest(async (db) => {
      const body = {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: '123456' },
                  messages: [
                    {
                      id: `wamid.dup${Date.now()}`,
                      from: '51900000003',
                      type: 'text',
                      text: { body: 'hola' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      assert.equal(await receiveWebhook(body), 1);
      assert.equal(await receiveWebhook(body), 1);
      assert.equal(
        (
          await query(
            db,
            "SELECT COUNT(*) n FROM dbo.App_WhatsAppInbox WHERE waId='51900000003' AND kind='message'",
          )
        ).recordset[0].n,
        1,
      );
    });
  } finally {
    await close();
  }
});

test('el webhook descarta mensajes incompletos y conserva números nuevos válidos', () => {
  const message = { id: 'valid', from: '51900000009', type: 'text', text: { body: 'Hola' } };
  const body = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: '123456' },
              messages: [
                { ...message, from: undefined },
                { ...message, from: 'undefined' },
                { ...message, from: '' },
                { ...message, id: '' },
                { ...message, type: undefined },
                message,
              ],
            },
          },
        ],
      },
    ],
  };
  assert.deepEqual(
    extractEvents(body, '123456').map((event) => event.waId),
    ['51900000009'],
  );
});

test('el webhook acepta BSUID sin teléfono, su longitud máxima y estados con recipient_user_id', () => {
  const userId = 'PE.' + 'A'.repeat(128);
  const body = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: '123456' },
              contacts: [{ user_id: userId, profile: { name: 'Persona' } }],
              messages: [{ id: 'bsuid-message', from_user_id: userId, ...typed('Hola') }],
              statuses: [{ id: 'bsuid-outbound', status: 'delivered', recipient_user_id: userId }],
            },
          },
        ],
      },
    ],
  };
  assert.deepEqual(
    extractEvents(body, '123456').map((event) => [event.kind, event.waId]),
    [
      ['message', userId],
      ['status', userId],
    ],
  );
  body.entry[0].changes[0].value.contacts[0].wa_id = '51900000001';
  assert.equal(extractEvents(body, '123456')[0].payload.from, '51900000001');
  body.entry[0].changes[0].value.contacts[0].user_id = 'PE.AnotherUser';
  assert.equal(extractEvents(body, '123456')[0].payload.from, undefined);
});

test('el cliente usa recipient para BSUID y conserva to para teléfonos', async () => {
  const sent = [];
  const client = whatsappClient(
    { token: 'fake', phoneNumberId: '123456' },
    async (_url, options) => {
      sent.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ messages: [{ id: 'wamid.reply' }] }) };
    },
  );
  await client.sendText('PE.1234567890', 'Hola');
  await client.sendText('51900000001', 'Hola');
  assert.equal(sent[0].recipient, 'PE.1234567890');
  assert.equal(sent[0].to, undefined);
  assert.equal(sent[1].to, '51900000001');
  assert.equal(sent[1].recipient, undefined);
});

test('un BSUID nuevo recibe el botón para compartir su número sin asignarse a otro contacto', async () => {
  try {
    await rollbackTest(async (db) => {
      const userId = 'PE.' + 'B'.repeat(128);
      const key = `m:bsuid-new-${Date.now()}`;
      await acceptWhatsAppEvent(db, {
        key,
        kind: 'message',
        waId: userId,
        payload: {
          id: key.slice(2),
          from_user_id: userId,
          ...typed('Hola, ya me registré en LaPreDigital'),
        },
      });
      const client = fakeWhatsApp();
      await pollWhatsApp(client);
      assert.equal(client.calls.length, 1);
      assert.equal(client.calls[0].recipient, userId);
      assert.equal(client.calls[0].to, undefined);
      assert.equal(client.calls[0].interactive.type, 'request_contact_info');
      assert.equal(await findWhatsAppContact(db, '123456', userId), undefined);
      const event = (
        await query(db, 'SELECT processedAt FROM dbo.App_WhatsAppInbox WHERE eventKey=@key', {
          key,
        })
      ).recordset[0];
      assert.ok(event.processedAt);
    });
  } finally {
    await close();
  }
});

test('el teléfono revelado vincula el BSUID y las siguientes respuestas conservan esa identidad', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup();
      const userId = `PE.${scenario.sequence}`;
      await receive(db, scenario, { ...typed('Hola'), from_user_id: userId });
      assert.equal(await findWhatsAppContact(db, '123456', userId), scenario.lead.contact);
      await flush(db, scenario);
      assert.ok(scenario.client.calls.length > 0);
      assert.ok(scenario.client.calls.every((call) => call.recipient === userId && !call.to));
      const other = await setup();
      assert.equal(await saveWhatsAppContact(db, '123456', userId, other.lead.contact), false);
      assert.equal(await findWhatsAppContact(db, 'another-business-number', userId), undefined);
      scenario.waId = userId;
      const countBefore = (await incomingRows(db, scenario)).length;
      await receive(db, scenario, { ...typed('Hola'), from: undefined, from_user_id: userId });
      assert.equal((await incomingRows(db, scenario)).length, countBefore + 1);
      assert.equal(await findWhatsAppContact(db, '123456', userId), scenario.lead.contact);
    });
  } finally {
    await close();
  }
});

test('compartir el número con el botón nativo inicia el cuestionario y no se trata como archivo', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup();
      const userId = `PE.${scenario.sequence}`;
      await receive(db, scenario, {
        from_user_id: userId,
        type: 'contacts',
        contacts: [{ origin: 'contact_request', phones: [{ wa_id: scenario.waId }] }],
      });
      assert.equal(await findWhatsAppContact(db, '123456', userId), scenario.lead.contact);
      const incoming = await incomingRows(db, scenario);
      assert.match(incoming[0].text, /Compartí mi número/);
      await flush(db, scenario);
      assert.ok(scenario.client.calls.some((call) => call.interactive?.type === 'list'));
      assert.ok(
        scenario.client.calls.every((call) => !JSON.stringify(call).includes('Recibí tu archivo')),
      );
    });
  } finally {
    await close();
  }
});

test('un evento antiguo sin remitente se registra como inválido y no bloquea al siguiente', async () => {
  try {
    await rollbackTest(async (db) => {
      const suffix = Date.now();
      const invalidKey = `m:invalid-${suffix}`;
      const validKey = `m:valid-${suffix}`;
      await acceptWhatsAppEvent(db, {
        key: invalidKey,
        kind: 'message',
        waId: 'undefined',
        payload: { id: `invalid-${suffix}`, ...typed('Hola') },
      });
      await acceptWhatsAppEvent(db, {
        key: validKey,
        kind: 'message',
        waId: '51999999990',
        payload: { id: `valid-${suffix}`, from: '51999999990', ...typed('Hola') },
      });
      const client = fakeWhatsApp();
      await pollWhatsApp(client);
      const events = (
        await query(
          db,
          'SELECT eventKey, processedAt, error FROM dbo.App_WhatsAppInbox WHERE eventKey IN (@invalid, @valid)',
          { invalid: invalidKey, valid: validKey },
        )
      ).recordset;
      assert.match(events.find((event) => event.eventKey === invalidKey).error, /Evento inválido/);
      assert.ok(events.every((event) => event.processedAt));
      assert.equal(client.calls.length, 1);
      assert.equal(client.calls[0].to, '51999999990');
    });
  } finally {
    await close();
  }
});

test('un número no registrado recibe el enlace de registro y no se crea ningún mensaje', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup();
      scenario.waId = '51999999990';
      await receive(db, scenario, typed('Hola'));
      assert.equal(scenario.client.calls.length, 1);
      assert.match(scenario.client.calls[0].text.body, /Aún no te tengo registrado/);
      assert.equal((await incomingRows(db, scenario)).length, 0);
    });
  } finally {
    await close();
  }
});

test('el primer saludo de un registrado abre el cuestionario con una lista y la elección se registra una vez', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup();
      await receive(db, scenario, typed('Hola'));
      await flush(db, scenario);
      const list = scenario.client.calls.at(-1);
      assert.equal(list.type, 'interactive');
      assert.match(list.interactive.body.text, /¿Qué carrera te gustaría estudiar\?/);
      const rows = list.interactive.action.sections[0].rows;
      assert.ok(rows.every((row) => row.title.length <= 24));
      const option = rows.find((row) => row.title === 'Ingeniería de Sistemas');
      assert.ok(option);
      const before = (await incomingRows(db, scenario)).length;
      await receive(db, scenario, chosen(option.id, option.title));
      const after = await incomingRows(db, scenario);
      assert.equal(after.length - before, 1);
      assert.equal(after.at(-1).idCanal, 1);
      assert.equal(after.at(-1).text, 'Ingeniería de Sistemas');
      const career = (
        await query(
          db,
          `SELECT pb.carreraDeseada career FROM dbo.LeadCaso lc JOIN dbo.Lead l ON l.idLead=lc.idLead
           JOIN dbo.PerfilBeneficiario pb ON pb.idBeneficiario=l.idBeneficiario WHERE lc.idLeadCaso=@id`,
          { id: scenario.lead.id },
        )
      ).recordset[0].career;
      assert.equal(career, 'Ingeniería de Sistemas');
      await flush(db, scenario);
      assert.match(
        scenario.client.calls.at(-1).interactive.body.text,
        /¿Cuánto tiempo puedes dedicar a estudiar\?/,
      );
    });
  } finally {
    await close();
  }
});

test('un mensaje de agenda fuera de las 24 horas usa la plantilla y queda entregado solo con el estado', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup();
      await query(
        db,
        'UPDATE dbo.IntentoContacto SET fechaProgramada=DATEADD(MINUTE,-1,DATEADD(HOUR,-5,SYSUTCDATETIME())) WHERE idLeadCaso=@id AND numeroIntento=1',
        { id: scenario.lead.id },
      );
      await reviewFollowup({ canSend: (channel) => channel === 1 });
      await flush(db, scenario);
      const sent = scenario.client.calls.at(-1);
      assert.equal(sent.type, 'template');
      assert.equal(sent.template.name, 'hello_world');
      const row = (
        await query(
          db,
          `SELECT m.idMensaje id, m.idEstadoEntrega state, m.usaPlantilla template
           FROM dbo.IntentoContacto i JOIN dbo.Mensaje m ON m.idMensaje=i.idMensajeEnvio
           WHERE i.idLeadCaso=@id AND i.numeroIntento=1`,
          { id: scenario.lead.id },
        )
      ).recordset[0];
      assert.equal(row.state, 1);
      assert.equal(row.template, true);
      await acceptWhatsAppEvent(db, {
        key: 's:wamid.salida1:delivered',
        kind: 'status',
        waId: scenario.waId,
        payload: { id: 'wamid.salida1', status: 'delivered', recipient_id: scenario.waId },
      });
      await pollWhatsApp(scenario.client);
      const delivered = (
        await query(
          db,
          'SELECT idEstadoEntrega state, fechaEntrega date FROM dbo.Mensaje WHERE idMensaje=@id',
          row,
        )
      ).recordset[0];
      assert.equal(delivered.state, 2);
      assert.ok(delivered.date);
    });
  } finally {
    await close();
  }
});

test('WhatsApp sin autorización: pregunta una vez con botones y registra el «No» como denegada', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup();
      await query(
        db,
        'DELETE FROM dbo.AutorizacionContacto WHERE idContacto=@contact AND idCanal=1',
        {
          contact: scenario.lead.contact,
        },
      );
      await receive(db, scenario, typed('Hola'));
      await flush(db, scenario);
      const prompt = scenario.client.calls.at(-1);
      assert.equal(prompt.interactive.type, 'button');
      const no = prompt.interactive.action.buttons.find(
        (button) => button.reply.title === 'No, gracias',
      );
      assert.ok(
        prompt.interactive.action.buttons.every((button) => button.reply.title.length <= 20),
      );
      await receive(db, scenario, {
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: { id: no.reply.id, title: no.reply.title },
        },
      });
      const auth = (
        await query(
          db,
          'SELECT idEstadoAutorizacion state, idOrigenAutorizacion origin FROM dbo.AutorizacionContacto WHERE idContacto=@contact AND idCanal=1',
          { contact: scenario.lead.contact },
        )
      ).recordset;
      assert.deepEqual(auth, [{ state: 3, origin: 3 }]);
      const rows = await incomingRows(db, scenario);
      assert.equal(rows.at(-1).text, 'No, gracias');
      await receive(db, scenario, typed('¿Cuánto cuesta Meta UNT?'));
      const prompts = (
        await query(
          db,
          "SELECT COUNT(*) n FROM dbo.Mensaje WHERE idContacto=@contact AND idDireccion=2 AND textoMensaje LIKE N'%escribamos por WhatsApp%'",
          { contact: scenario.lead.contact },
        )
      ).recordset[0].n;
      assert.equal(prompts, 1);
    });
  } finally {
    await close();
  }
});

test('WhatsApp: «ya no quiero que me contacten» suspende y bloquea el seguimiento pendiente', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup();
      await saveConsent(scenario.lead.id, { channel: 2, granted: true, version: 'test' });
      await query(
        db,
        'UPDATE dbo.IntentoContacto SET fechaProgramada=DATEADD(MINUTE,-1,DATEADD(HOUR,-5,SYSUTCDATETIME())) WHERE idLeadCaso=@id AND numeroIntento=1',
        { id: scenario.lead.id },
      );
      await reviewFollowup({ canSend: (channel) => channel === 1 });
      const before = (
        await query(db, 'SELECT COUNT(*) n FROM dbo.IntentoContacto WHERE idLeadCaso=@id', {
          id: scenario.lead.id,
        })
      ).recordset[0].n;
      const text = 'ya no quiero que me contacten, no los quiero';
      await receive(db, scenario, typed(text));
      const state = (
        await query(
          db,
          `SELECT lc.idEstadoParticipacion state, lc.idMotivoSuspension reason, c.idEstadoCaso caseState,
            (SELECT COUNT(*) FROM dbo.AutorizacionContacto a WHERE a.idContacto=l.idContacto AND a.idEstadoAutorizacion=1) authorizations,
            (SELECT COUNT(*) FROM dbo.IntentoContacto i WHERE i.idLeadCaso=lc.idLeadCaso) attempts
          FROM dbo.LeadCaso lc INNER JOIN dbo.Lead l ON l.idLead=lc.idLead
          INNER JOIN dbo.Caso c ON c.idCaso=lc.idCaso WHERE lc.idLeadCaso=@id`,
          { id: scenario.lead.id },
        )
      ).recordset[0];
      assert.deepEqual(state, {
        state: 2,
        reason: 2,
        caseState: 1,
        authorizations: 0,
        attempts: before,
      });
      assert.equal((await incomingRows(db, scenario)).at(-1).text, text);
      assert.equal(scenario.client.calls.length, 1);
      assert.match(scenario.client.calls[0].text.body, /no te escribiremos más/);
      await flush(db, scenario);
      assert.equal(scenario.client.calls.length, 1);
    });
  } finally {
    await close();
  }
});

test('WhatsApp: el primer «Hola quiero enviarle el link de invitación a mi esposa» atiende la invitación', async (t) => {
  const settings = {
    OLLAMA_ENABLED: process.env.OLLAMA_ENABLED,
    OPENAI_ENABLED: process.env.OPENAI_ENABLED,
  };
  process.env.OLLAMA_ENABLED = 'true';
  process.env.OPENAI_ENABLED = 'false';
  t.after(() => {
    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const model = t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      message: {
        content: JSON.stringify({
          level: 1,
          retraction: false,
          action: 'ask',
          tariffId: null,
          fields: [],
          understood: true,
          needsGuardian: false,
          guardian: null,
        }),
      },
    }),
  }));
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup({ role: 2, beneficiaryName: `David ${Date.now()}` });
      await saveProfile(scenario.lead.id, {
        fields: { career: 'Ingeniería de Sistemas' },
        channel: 1,
      });
      await receive(db, scenario, typed('Hola quiero enviarle el link de invitación a mi esposa'));
      const reply = (
        await query(
          db,
          'SELECT TOP 1 textoMensaje text FROM dbo.Mensaje WHERE idLeadCaso=@id AND idDireccion=2 ORDER BY idMensaje DESC',
          { id: scenario.lead.id },
        )
      ).recordset[0];
      assert.match(reply.text, /esposa/);
      assert.match(reply.text, /su nombre completo y su número de celular/);
      assert.doesNotMatch(reply.text, /cuánto tiempo|horas|presupuesto/);
      assert.equal(model.mock.calls.length, 1);
    });
  } finally {
    await close();
  }
});
