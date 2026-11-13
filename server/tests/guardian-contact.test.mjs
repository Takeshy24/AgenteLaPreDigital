import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { close, query, rollbackTest } from '../db.mjs';
import { saveConsent } from '../consents/service.mjs';
import { dispatchMessage } from '../integrations/dispatch.mjs';
import {
  acceptUpdate,
  acceptWhatsAppEvent,
  getWhatsAppEvent,
  pendingUpdates,
} from '../integrations/repository.mjs';
import { processUpdate } from '../integrations/telegram.mjs';
import { pollWhatsApp, processWhatsAppMessage } from '../integrations/whatsapp.mjs';
import { createLead } from '../leads/service.mjs';
import { recordIncoming } from '../messages/service.mjs';
import { viewInvitation } from '../public/invitations.mjs';
import { deliverDirectInvitation, INVITATION_IMPEDIMENTS } from '../links/direct.mjs';

process.env.SMTP_PASSWORD = '';
process.env.TELEGRAM_ENABLED = 'true';
process.env.TELEGRAM_BOT_TOKEN = 'telegram-simulado';
process.env.WHATSAPP_ENABLED = 'true';
process.env.WHATSAPP_TOKEN = 'whatsapp-simulado';
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456';
process.env.OLLAMA_ENABLED = 'true';

const modelAnswer = (changes = {}) => ({
  level: 1,
  retraction: false,
  action: 'ask',
  tariffId: null,
  fields: [],
  understood: true,
  needsGuardian: false,
  guardian: null,
  ...changes,
});
test.beforeEach((context) => {
  context.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ message: { content: JSON.stringify(modelAnswer()) } }),
  }));
});

function phone() {
  return '+519' + String(Date.now() + Math.floor(Math.random() * 1000000)).slice(-8);
}

async function setup(db, channel = 3) {
  const id = Date.now() + Math.floor(Math.random() * 1000000);
  const lead = await createLead({
    name: `Alumno ${randomUUID()}`,
    email: `${randomUUID()}@example.test`,
    phone: phone(),
    role: 1,
    channel: 5,
    communicationChannel: 2,
    consent: true,
  });
  const chat = String(id);
  if (channel === 3)
    await query(db, 'INSERT dbo.App_TelegramChat(idContacto,chatId) VALUES(@contact,@chat)', {
      contact: lead.contact,
      chat,
    });
  const calls = [];
  const client = {
    call: async (method, data) => {
      calls.push({ method, data });
      return { message_id: calls.length };
    },
    send: async (data) => {
      calls.push(data);
      return `wamid.invite-test-${id}-${calls.length}`;
    },
  };
  let sequence = id;
  const number = (
    await query(db, 'SELECT telefono FROM dbo.Contacto WHERE idContacto=@contact', {
      contact: lead.contact,
    })
  ).recordset[0].telefono;
  const lastReply = async () =>
    (
      await query(
        db,
        `SELECT TOP 1 idMensaje id,textoMensaje text,idCanal channel FROM dbo.Mensaje m
WHERE idLeadCaso=@id AND idDireccion=2 AND NOT EXISTS (
  SELECT 1 FROM dbo.App_Dispatch d WHERE d.idMensaje=m.idMensaje AND JSON_VALUE(d.markup,'$.consent_prompt')='true'
) ORDER BY idMensaje DESC`,
        { id: lead.id },
      )
    ).recordset[0];
  async function say(text) {
    const updateId = ++sequence;
    if (channel === 1) {
      const key = `m:wamid.invite-input-${updateId}`;
      await acceptWhatsAppEvent(db, {
        key,
        kind: 'message',
        waId: number.slice(1),
        payload: { id: key.slice(2), from: number.slice(1), type: 'text', text: { body: text } },
      });
      await processWhatsAppMessage(await getWhatsAppEvent(db, key), client);
    } else {
      await acceptUpdate(db, {
        update_id: updateId,
        message: {
          message_id: updateId,
          from: { is_bot: false },
          chat: { id: chat, type: 'private' },
          text,
        },
      });
      await processUpdate(
        (await pendingUpdates(db)).find((item) => item.updateId === updateId),
        client,
      );
    }
    return lastReply();
  }
  return { lead, say, lastReply, client };
}

async function father(db, { channel = 1, consent = true, recent = true } = {}) {
  const number = phone();
  const lead = await createLead({
    name: 'Carlos Ruiz',
    email: `${randomUUID()}@example.test`,
    phone: number,
    role: 2,
    beneficiaryName: `Otro alumno ${randomUUID()}`,
    channel: 5,
    communicationChannel: channel,
    consent,
  });
  if (channel === 3) {
    await query(
      db,
      'UPDATE dbo.Contacto SET usuarioTelegram=@chat,inicioBotTelegram=1 WHERE idContacto=@contact; INSERT dbo.App_TelegramChat(idContacto,chatId) VALUES(@contact,@chat)',
      {
        contact: lead.contact,
        chat: `father-${randomUUID().slice(0, 16)}`,
      },
    );
    if (consent) await saveConsent(lead.id, { channel: 3, granted: true, version: 'test' });
  }
  if (channel === 1 && recent)
    await recordIncoming(lead.id, { text: 'Hola', channel: 1, level: 1 });
  return { ...lead, phone: number };
}

async function request(db, student, parent) {
  await student.say(
    'Quiero que le envies un mensaje a mi padre para que el se haga cargo del pago',
  );
  return student.say(`Carlos Ruiz ${parent.phone}`);
}

async function directMessage(db, parent) {
  return (
    await query(
      db,
      `SELECT TOP 1 m.idMensaje id,m.idEstadoEntrega status,d.state,d.externalId,d.markup
FROM dbo.Mensaje m JOIN dbo.App_Dispatch d ON d.idMensaje=m.idMensaje
WHERE m.idContacto=@contact AND m.idDireccion=2 AND JSON_VALUE(d.markup,'$.invitation.code') IS NOT NULL
ORDER BY m.idMensaje DESC`,
      { contact: parent.contact },
    )
  ).recordset[0];
}

for (const channel of [1, 3]) {
  test(`${channel === 1 ? 'WhatsApp' : 'Telegram'}: la IA interpreta una delegación nueva antes de validar las funciones`, async (context) => {
    const requests = [];
    context.mock.method(globalThis, 'fetch', async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return {
        ok: true,
        json: async () => ({
          message: { content: JSON.stringify(modelAnswer({ needsGuardian: true })) },
        }),
      };
    });
    try {
      await rollbackTest(async (db) => {
        const student = await setup(db, channel);
        const reply = await student.say('Mi tío tramitará el pago por mí');
        assert.equal(requests.length, 1);
        assert.match(
          requests[0].messages[0].content,
          /Funciones configuradas:.*guardianInvitations/,
        );
        assert.match(requests[0].messages[0].content, /documentos activos recuperados/);
        assert.equal(requests[0].messages.at(-1).content, 'Mi tío tramitará el pago por mí');
        assert.match(reply.text, /tu tío/);
        assert.match(reply.text, /su nombre completo y su número de celular/);
        const analysis = (
          await query(
            db,
            'SELECT TOP 1 a.payload FROM dbo.App_AgentAnalysis a JOIN dbo.Mensaje m ON m.idMensaje=a.idMensaje WHERE m.idLeadCaso=@id ORDER BY m.idMensaje DESC',
            { id: student.lead.id },
          )
        ).recordset[0];
        assert.equal(JSON.parse(analysis.payload).provider, 'ollama');
      });
    } finally {
      await close();
    }
  });

  test(`${channel === 1 ? 'WhatsApp' : 'Telegram'}: una consulta durante la invitación no se guarda como nombre del familiar`, async (context) => {
    let input = 0;
    context.mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify(modelAnswer({ action: ++input === 2 ? 'catalog' : 'ask' })),
        },
      }),
    }));
    try {
      await rollbackTest(async (db) => {
        const student = await setup(db, channel);
        await student.say('Quiero que mi abuelo maneje el pago');
        const reply = await student.say('Medios de pago');
        assert.doesNotMatch(reply.text, /invitación de Medios De Pago|solo me falta su número/);
        const data = (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.InvitacionVinculacion i JOIN dbo.NecesidadVinculacion n ON n.idNecesidad=i.idNecesidad WHERE n.idLeadCasoDeclara=@id',
            { id: student.lead.id },
          )
        ).recordset[0];
        assert.equal(data.n, 0);
      });
    } finally {
      await close();
    }
  });

  test(`${channel === 1 ? 'WhatsApp' : 'Telegram'}: manejar el pago inicia la invitación y corregir abuelo por padre reinicia sus datos`, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('No debe consultar IA ni enviar mensajes reales');
    };
    try {
      await rollbackTest(async (db) => {
        const student = await setup(db, channel);
        let reply = await student.say('Quiero que mi abuelo maneje el tema del pago porfavor');
        assert.match(reply.text, /tu abuelo/);
        assert.match(reply.text, /su nombre completo y su número de celular/);
        assert.doesNotMatch(reply.text, /pasarela|Ejercicios por curso|Qué plan|Qué carrera/);
        reply = await student.say('pero mi padre debe hacer el pago');
        assert.match(reply.text, /continuamos con tu papá/);
        assert.match(reply.text, /su nombre completo y su número de celular/);
        assert.doesNotMatch(reply.text, /pasarela|Qué plan|Qué carrera/);
        await student.say('Se llama Carlos Ruiz');
        reply = await student.say(phone());
        assert.match(reply.text, /Preparé la invitación para Carlos Ruiz/);
        assert.match(reply.text, /No tengo una autorización de contacto/);
        const invitation = (
          await query(
            db,
            'SELECT i.idRolInvitado role,i.nombreInvitado name FROM dbo.InvitacionVinculacion i JOIN dbo.NecesidadVinculacion n ON n.idNecesidad=i.idNecesidad WHERE n.idLeadCasoDeclara=@id',
            { id: student.lead.id },
          )
        ).recordset;
        assert.deepEqual(invitation, [{ role: 2, name: 'Carlos Ruiz' }]);
      });
    } finally {
      globalThis.fetch = originalFetch;
      await close();
    }
  });

  test(`${channel === 1 ? 'WhatsApp' : 'Telegram'}: al cambiar de responsable no usa el nombre declarado para el abuelo`, async () => {
    try {
      await rollbackTest(async (db) => {
        const student = await setup(db, channel);
        await student.say('Quiero que mi abuelo maneje el tema del pago');
        await student.say('Se llama José Pérez');
        let reply = await student.say('pero mi padre debe hacer el pago');
        assert.match(reply.text, /su nombre completo y su número de celular/);
        reply = await student.say(phone());
        assert.match(reply.text, /su nombre completo/);
        assert.doesNotMatch(reply.text, /Preparé la invitación|José/);
        reply = await student.say('Carlos Ruiz');
        assert.match(reply.text, /Preparé la invitación para Carlos Ruiz/);
        assert.doesNotMatch(reply.text, /José/);
      });
    } finally {
      await close();
    }
  });

  test(`${channel === 1 ? 'WhatsApp' : 'Telegram'}: pedir contactar al padre reúne sus datos y explica la falta de autorización`, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('Esta solicitud no debe depender de IA ni de servicios externos');
    };
    try {
      await rollbackTest(async (db) => {
        const student = await setup(db, channel);
        const number = phone();
        let reply = await student.say(
          'Quiero que le envies un mensaje a mi padre para que el se haga cargo del pago',
        );
        assert.match(reply.text, /su nombre completo y su número de celular/);
        assert.doesNotMatch(reply.text, /Qué plan|Qué carrera/);
        reply = await student.say('quiero que hables mi padre sobre eso');
        assert.match(reply.text, /su nombre completo y su número de celular/);
        await student.say('Carlos Ruiz');
        reply = await student.say(number);
        assert.match(reply.text, /No tengo una autorización de contacto/);
        assert.match(reply.text, /Preparé la invitación para Carlos Ruiz/);
        assert.match(reply.text, /https:\/\/wa.me\/\d+\?text=/);
        assert.match(reply.text, /\/invitacion\/[a-f0-9-]{36}/);
        assert.equal(reply.channel, channel);
        assert.equal(
          (
            await query(db, 'SELECT COUNT(*) n FROM dbo.Contacto WHERE telefono=@phone', {
              phone: number,
            })
          ).recordset[0].n,
          0,
        );
      });
    } finally {
      globalThis.fetch = originalFetch;
      await close();
    }
  });
}

test('un familiar registrado sin autorización recibe cero mensajes y el usuario obtiene el enlace', async () => {
  try {
    await rollbackTest(async (db) => {
      const student = await setup(db);
      const parent = await father(db, { consent: false });
      const reply = await request(db, student, parent);
      assert.match(reply.text, /No tengo una autorización de contacto/);
      assert.match(reply.text, /\/invitacion\//);
      assert.equal(await directMessage(db, parent), undefined);
    });
  } finally {
    await close();
  }
});

test('negar el envío no prepara una invitación aunque el mensaje incluya todos los datos', async () => {
  try {
    await rollbackTest(async (db) => {
      const student = await setup(db);
      const parent = await father(db);
      await student.say('Quiero que hables con mi padre');
      const reply = await student.say(
        `No quiero que le escribas a mi padre Carlos Ruiz ${parent.phone} aunque él paga`,
      );
      assert.match(reply.text, /no enviaré una invitación/);
      assert.equal(await directMessage(db, parent), undefined);
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.InvitacionVinculacion i JOIN dbo.NecesidadVinculacion n ON n.idNecesidad=i.idNecesidad WHERE n.idLeadCasoDeclara=@id',
            { id: student.lead.id },
          )
        ).recordset[0].n,
        0,
      );
    });
  } finally {
    await close();
  }
});

test('WhatsApp sin ventana disponible conserva la autorización y explica el impedimento del canal', async () => {
  try {
    await rollbackTest(async (db) => {
      const student = await setup(db);
      const parent = await father(db, { recent: false });
      const reply = await request(db, student, parent);
      assert.match(reply.text, /no hay una conversación reciente/);
      assert.doesNotMatch(reply.text, /No tengo una autorización/);
      assert.match(reply.text, /\/invitacion\//);
      assert.equal(await directMessage(db, parent), undefined);
    });
  } finally {
    await close();
  }
});

test('una autorización revocada después de preparar el envío impide contactar y avisa una vez', async () => {
  try {
    await rollbackTest(async (db) => {
      const student = await setup(db, 1);
      const parent = await father(db);
      const reply = await request(db, student, parent);
      assert.match(reply.text, /pendiente de confirmación/);
      assert.doesNotMatch(reply.text, /le envié/);
      const direct = await directMessage(db, parent);
      await saveConsent(parent.id, { channel: 1, granted: false, version: 'test' });
      let sends = 0;
      const client = {
        send: async () => {
          sends++;
          return 'should-not-send';
        },
      };
      await dispatchMessage(direct.id, null, { whatsapp: client });
      const notice = await student.lastReply();
      assert.match(notice.text, /No tengo una autorización de contacto/);
      assert.match(notice.text, /\/invitacion\//);
      assert.equal(notice.channel, 1);
      await dispatchMessage(direct.id, null, { whatsapp: client });
      assert.equal((await student.lastReply()).id, notice.id);
      assert.equal(sends, 0);
    });
  } finally {
    await close();
  }
});

test('un fallo confirmado de Telegram devuelve el enlace y no presenta el mensaje como enviado', async () => {
  try {
    await rollbackTest(async (db) => {
      const student = await setup(db);
      const parent = await father(db, { channel: 3 });
      const reply = await request(db, student, parent);
      assert.match(reply.text, /directamente por Telegram; está pendiente/);
      const direct = await directMessage(db, parent);
      const code = JSON.parse(direct.markup).invitation.code;
      assert.equal((await viewInvitation(code)).known, false);
      await dispatchMessage(direct.id, {
        call: async () => {
          const error = new Error('El bot fue bloqueado');
          error.uncertain = false;
          throw error;
        },
      });
      const notice = await student.lastReply();
      assert.match(notice.text, /El canal no permitió completar el envío/);
      assert.match(notice.text, /\/invitacion\//);
      assert.equal((await directMessage(db, parent)).status, 3);
      assert.equal((await viewInvitation(code)).known, false);
    });
  } finally {
    await close();
  }
});

test('WhatsApp confirma con su webhook y los fallos posteriores generan un solo enlace de respaldo', async () => {
  try {
    await rollbackTest(async (db) => {
      const student = await setup(db);
      const parent = await father(db);
      await request(db, student, parent);
      const direct = await directMessage(db, parent);
      const code = JSON.parse(direct.markup).invitation.code;
      const client = { send: async () => `wamid.parent-${direct.id}` };
      await dispatchMessage(direct.id, null, { whatsapp: client });
      assert.equal((await directMessage(db, parent)).status, 1);
      assert.equal((await viewInvitation(code)).known, false);
      for (const suffix of ['first', 'duplicate']) {
        await acceptWhatsAppEvent(db, {
          key: `s:failed-parent-${direct.id}-${suffix}`,
          kind: 'status',
          waId: parent.phone.slice(1),
          payload: {
            id: `wamid.parent-${direct.id}`,
            status: 'failed',
            errors: [{ title: 'Recipient unavailable' }],
          },
        });
        await pollWhatsApp(client);
        if (suffix === 'first') student.notice = await student.lastReply();
      }
      assert.match(student.notice.text, /El canal no permitió completar el envío/);
      assert.equal((await student.lastReply()).id, student.notice.id);
      assert.equal((await directMessage(db, parent)).status, 3);
    });
  } finally {
    await close();
  }
});

test('WhatsApp entrega la invitación autorizada y no repite el envío al pedirla nuevamente', async () => {
  try {
    await rollbackTest(async (db) => {
      const student = await setup(db);
      const parent = await father(db);
      await request(db, student, parent);
      const direct = await directMessage(db, parent);
      const code = JSON.parse(direct.markup).invitation.code;
      let sends = 0;
      const client = {
        send: async () => {
          sends++;
          return `wamid.delivered-parent-${direct.id}`;
        },
      };
      await dispatchMessage(direct.id, null, { whatsapp: client });
      await acceptWhatsAppEvent(db, {
        key: `s:delivered-parent-${direct.id}`,
        kind: 'status',
        waId: parent.phone.slice(1),
        payload: { id: `wamid.delivered-parent-${direct.id}`, status: 'delivered' },
      });
      await pollWhatsApp(client);
      assert.equal((await directMessage(db, parent)).status, 2);
      assert.equal((await viewInvitation(code)).known, true);
      const reply = await student.say(`Mi padre Carlos Ruiz, su teléfono es ${parent.phone}`);
      assert.match(reply.text, /El canal confirmó el envío/);
      assert.equal((await directMessage(db, parent)).id, direct.id);
      await dispatchMessage(direct.id, null, { whatsapp: client });
      assert.equal(sends, 1);
    });
  } finally {
    await close();
  }
});

test('una respuesta incierta del canal avisa sin afirmar entrega ni reintentar', async () => {
  try {
    await rollbackTest(async (db) => {
      const student = await setup(db);
      const parent = await father(db, { channel: 3 });
      await request(db, student, parent);
      const direct = await directMessage(db, parent);
      let sends = 0;
      const client = {
        call: async () => {
          sends++;
          const error = new Error('Tiempo agotado');
          error.uncertain = true;
          throw error;
        },
      };
      await dispatchMessage(direct.id, client);
      const notice = await student.lastReply();
      assert.match(notice.text, /No pude confirmar si el canal recibió/);
      assert.match(notice.text, /\/invitacion\//);
      await dispatchMessage(direct.id, client);
      assert.equal(sends, 1);
      assert.equal((await directMessage(db, parent)).state, 'unknown');
    });
  } finally {
    await close();
  }
});

test('un teléfono compartido por dos contactos no decide a quién enviar la invitación', async () => {
  try {
    await rollbackTest(async (db) => {
      const student = await setup(db);
      const parent = await father(db);
      const other = await createLead({
        name: 'Otro contacto',
        email: `${randomUUID()}@example.test`,
        phone: parent.phone,
        role: 1,
        channel: 5,
        communicationChannel: 1,
        consent: true,
      });
      const reply = await request(db, student, parent);
      assert.match(reply.text, /autorización de contacto verificable/);
      assert.match(reply.text, /\/invitacion\//);
      assert.equal(await directMessage(db, parent), undefined);
      assert.equal(await directMessage(db, other), undefined);
    });
  } finally {
    await close();
  }
});

test('fallo SMTP devuelve un motivo de entrega y no deja un envío ficticio', async () => {
  try {
    await rollbackTest(async (db) => {
      const student = await setup(db);
      const parent = await father(db, { channel: 2 });
      const incoming = await recordIncoming(student.lead.id, {
        text: 'Mi padre paga',
        channel: 3,
        level: 1,
      });
      const result = await deliverDirectInvitation(
        db,
        {
          target: { id: parent.contact },
          text: 'Invitación',
          replyTo: incoming.id,
          email: { subject: 'Invitación', text: 'Invitación' },
        },
        {
          mailer: async () => {
            throw new Error('SMTP rechazó la entrega');
          },
        },
      );
      assert.deepEqual(result, { reason: INVITATION_IMPEDIMENTS.delivery });
      assert.equal(await directMessage(db, parent), undefined);
    });
  } finally {
    await close();
  }
});
