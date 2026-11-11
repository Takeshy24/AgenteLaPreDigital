import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { close, query, rollbackTest } from '../db.mjs';
import { reviewFollowup } from '../followup/service.mjs';
import { dispatchMessage } from '../integrations/dispatch.mjs';
import { acceptWhatsAppEvent } from '../integrations/repository.mjs';
import {
  extractEvents,
  pollWhatsApp,
  receiveWebhook,
  verifyWebhookChallenge,
  verifyWhatsAppSignature,
} from '../integrations/whatsapp.mjs';
import { createLead } from '../leads/service.mjs';

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

async function setup() {
  const suffix = Date.now() + Math.floor(Math.random() * 1000);
  const phone = `+519${String(suffix).slice(-8)}`;
  const lead = await createLead({
    name: 'Estudiante WhatsApp',
    email: `wsp-${suffix}@example.test`,
    phone,
    role: 1,
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
