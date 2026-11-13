import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { isRegistrationGreeting, isSimpleGreeting } from '../agent/opening.mjs';
import { close, query, rollbackTest } from '../db.mjs';
import { dispatchMessage } from '../integrations/dispatch.mjs';
import {
  acceptUpdate,
  acceptWhatsAppEvent,
  getWhatsAppEvent,
  pendingUpdates,
  saveSelection,
} from '../integrations/repository.mjs';
import { processUpdate } from '../integrations/telegram.mjs';
import { processWhatsAppMessage } from '../integrations/whatsapp.mjs';
import { findWhatsAppContact } from '../integrations/whatsapp-repository.mjs';
import { createLead } from '../leads/service.mjs';
import { completeOnboarding } from '../onboarding/service.mjs';
import { listPending } from '../pending/service.mjs';
import { saveProfile } from '../profiles/service.mjs';
import { listInquiries } from '../public/repository.mjs';

process.env.SMTP_PASSWORD = '';
process.env.WHATSAPP_ENABLED = 'true';
process.env.WHATSAPP_PHONE_NUMBER_ID = '123456';

function scenario(channel) {
  const id = Date.now() + Math.floor(Math.random() * 1000000);
  const calls = [];
  const client = {
    calls,
    call: async (method, payload) => {
      if (method === 'sendMessage') calls.push(payload);
      return { message_id: calls.length };
    },
    send: async (payload) => {
      calls.push(payload);
      return `wamid.test-${id}-${calls.length}`;
    },
  };
  client.sendText = (to, body) => client.send({ to, type: 'text', text: { body } });
  return {
    channel,
    phone: `+519${String(id).slice(-8)}`,
    chat: String(id),
    sequence: id,
    client,
  };
}

async function send(db, chat, text) {
  const id = ++chat.sequence;
  if (chat.channel === 1) {
    const key = `m:wamid.test-input-${id}`;
    await acceptWhatsAppEvent(db, {
      key,
      kind: 'message',
      waId: chat.phone.slice(1),
      payload: { id: key.slice(2), from: chat.phone.slice(1), type: 'text', text: { body: text } },
    });
    const item = await getWhatsAppEvent(db, key);
    await processWhatsAppMessage(item, chat.client);
    await processWhatsAppMessage(item, chat.client);
  } else {
    await acceptUpdate(db, {
      update_id: id,
      message: {
        message_id: id,
        from: { id, is_bot: false },
        chat: { id: chat.chat, type: 'private' },
        text,
      },
    });
    const item = (await pendingUpdates(db)).find((row) => row.updateId === id);
    await processUpdate(item, chat.client);
    await processUpdate(item, chat.client);
  }
}

const lastText = (chat) => {
  const payload = chat.client.calls.at(-1);
  return typeof payload?.text === 'string'
    ? payload.text
    : payload?.text?.body || payload?.interactive?.body?.text;
};

async function contactOf(db, chat) {
  if (chat.channel === 1) return findWhatsAppContact(db, '123456', chat.phone.slice(1));
  return (
    await query(db, 'SELECT idContacto id FROM dbo.App_TelegramChat WHERE chatId=@chat', {
      chat: chat.chat,
    })
  ).recordset[0]?.id;
}

async function flush(db, chat, contact) {
  const rows = (
    await query(
      db,
      'SELECT idMensaje id FROM dbo.Mensaje WHERE idContacto=@contact AND idDireccion=2 AND idCanal=@channel AND idEstadoEntrega=1 ORDER BY idMensaje',
      { contact, channel: chat.channel },
    )
  ).recordset;
  for (const row of rows)
    await dispatchMessage(row.id, chat.channel === 3 ? chat.client : null, {
      whatsapp: chat.channel === 1 ? chat.client : null,
    });
}

async function createExisting(db, chat, name = `Alumno ${randomUUID()}`) {
  const email = `${randomUUID()}@example.test`;
  const lead = await createLead({
    name,
    email,
    phone: chat.phone,
    role: 1,
    channel: 5,
    communicationChannel: 2,
    consent: true,
  });
  if (chat.channel === 3)
    await query(db, 'INSERT dbo.App_TelegramChat(idContacto,chatId) VALUES(@contact,@chat)', {
      contact: lead.contact,
      chat: chat.chat,
    });
  return { ...lead, name, email };
}

test('el aviso de registro inicia preguntas y no absorbe solicitudes con un saludo', () => {
  for (const text of [
    'Hola, ya me registré en LaPreDigital',
    'Ya completé mi formulario',
    'Me acabo de registrar',
  ])
    assert.equal(isRegistrationGreeting(text), true, text);
  for (const text of [
    'Hola quiero invitar a mi esposa',
    'Ya me registré y quiero pagar Ruta UNT',
    '¿Qué es LaPreDigital?',
  ])
    assert.equal(isRegistrationGreeting(text), false, text);
  assert.equal(isSimpleGreeting('¡Hola! 😊'), true);
});

for (const channel of [1, 3]) {
  const label = channel === 1 ? 'WhatsApp' : 'Telegram';
  test(`${label}: un registrado empieza por carrera y retoma el siguiente dato desconocido`, async () => {
    try {
      await rollbackTest(async (db) => {
        const chat = scenario(channel);
        const lead = await createExisting(db, chat);
        await send(db, chat, 'Hola, ya me registré en LaPreDigital');
        await flush(db, chat, lead.contact);
        const questions = (
          await query(
            db,
            'SELECT m.textoMensaje text, d.markup FROM dbo.Mensaje m JOIN dbo.App_Dispatch d ON d.idMensaje=m.idMensaje WHERE m.idLeadCaso=@id AND d.markup IS NOT NULL ORDER BY m.idMensaje',
            { id: lead.id },
          )
        ).recordset;
        assert.ok(questions.some((row) => /Qué carrera/.test(row.text) && /pf:/.test(row.markup)));
        await saveProfile(lead.id, { fields: { career: 'Derecho' }, channel });
        await send(db, chat, 'Hola, ya me registré en LaPreDigital');
        await flush(db, chat, lead.contact);
        assert.match(lastText(chat), /Cuánto tiempo puedes dedicar a estudiar/);
        assert.doesNotMatch(lastText(chat), /Qué carrera/);
        await send(db, chat, '¡Hola!');
        await flush(db, chat, lead.contact);
        assert.match(lastText(chat), /Cuánto tiempo puedes dedicar a estudiar/);
        assert.equal(
          (
            await query(
              db,
              'SELECT COUNT(*) n FROM dbo.App_AgentAnalysis a JOIN dbo.Mensaje m ON m.idMensaje=a.idMensaje WHERE m.idContacto=@contact',
              { contact: lead.contact },
            )
          ).recordset[0].n,
          0,
        );
      });
    } finally {
      await close();
    }
  });

  test(`${label}: el saludo respeta el beneficiario seleccionado entre varias participaciones`, async () => {
    try {
      await rollbackTest(async (db) => {
        const chat = scenario(channel);
        const lead = await createExisting(db, chat);
        const other = await createLead({
          name: lead.name,
          email: lead.email,
          phone: chat.phone,
          role: 2,
          beneficiaryName: `Beneficiario ${randomUUID()}`,
          channel: 5,
          communicationChannel: 2,
          consent: true,
        });
        await saveSelection(db, lead.contact, other.id);
        await send(db, chat, 'Hola, ya me registré en LaPreDigital');
        await flush(db, chat, lead.contact);
        const reply = (
          await query(
            db,
            'SELECT TOP 1 m.idLeadCaso, m.textoMensaje text FROM dbo.Mensaje m JOIN dbo.App_Dispatch d ON d.idMensaje=m.idMensaje WHERE m.idContacto=@contact AND d.markup LIKE @markup ORDER BY m.idMensaje DESC',
            {
              contact: lead.contact,
              markup: '%pf:%',
            },
          )
        ).recordset[0];
        assert.equal(reply.idLeadCaso, other.id);
        assert.match(reply.text, /Qué carrera le gustaría estudiar a Beneficiario/);
      });
    } finally {
      await close();
    }
  });

  test(`${label}: el registro guarda datos progresivos, autoriza solo el canal y continúa con el perfil`, async () => {
    try {
      await rollbackTest(async (db) => {
        const chat = scenario(channel);
        await send(db, chat, 'Hola');
        assert.match(lastText(chat), /nombre completo/);
        assert.doesNotMatch(lastText(chat), /Regístrate aquí|vercel\.app/);
        const contact = await contactOf(db, chat);
        const initial = (
          await query(
            db,
            'SELECT nombreCompleto name, correo email, telefono phone FROM dbo.Contacto WHERE idContacto=@contact',
            { contact },
          )
        ).recordset[0];
        assert.equal(initial.name, null);
        assert.equal(initial.email, null);
        if (channel === 1) assert.equal(initial.phone, chat.phone);
        const inquiry = (await listInquiries(db)).find(
          (row) => row.phone === chat.phone || (channel === 3 && row.plan === 'Captación Telegram'),
        );
        assert.ok(inquiry);
        assert.equal(inquiry.role, null);
        assert.equal(inquiry.communicationChannel, channel);
        const name = `Alumno ${randomUUID()}`;
        const email = `${randomUUID()}@example.test`;
        await send(db, chat, name);
        assert.match(lastText(chat), /correo electrónico/);
        await send(db, chat, 'correo inválido');
        assert.match(lastText(chat), /correo electrónico/);
        await send(db, chat, email);
        if (channel === 3) {
          assert.match(lastText(chat), /teléfono con código de país/);
          await send(db, chat, chat.phone);
        }
        assert.match(lastText(chat), /Cuál es tu rol/);
        const partial = (
          await query(
            db,
            'SELECT nombreCompleto name,correo email FROM dbo.Contacto WHERE idContacto=@contact',
            { contact },
          )
        ).recordset[0];
        assert.deepEqual(partial, { name, email });
        await send(db, chat, '1');
        assert.match(lastText(chat), new RegExp(`seguimiento comercial por ${label}`));
        await send(db, chat, 'AUTORIZO');
        assert.match(lastText(chat), /Registro completado.*Qué carrera/s);
        const lead = (
          await query(
            db,
            'SELECT l.idLead,l.idBeneficiario,lc.idLeadCaso FROM dbo.Lead l JOIN dbo.LeadCaso lc ON lc.idLead=l.idLead WHERE l.idContacto=@contact',
            { contact },
          )
        ).recordset;
        assert.equal(lead.length, 1);
        assert.equal(
          (
            await query(db, 'SELECT COUNT(*) n FROM dbo.App_Onboarding WHERE idContacto=@contact', {
              contact,
            })
          ).recordset[0].n,
          0,
        );
        assert.deepEqual(
          (
            await query(
              db,
              'SELECT idCanal FROM dbo.AutorizacionContacto WHERE idContacto=@contact AND idEstadoAutorizacion=1',
              { contact },
            )
          ).recordset.map((row) => row.idCanal),
          [channel],
        );
        const markup = (
          await query(
            db,
            'SELECT TOP 1 d.markup FROM dbo.Mensaje m JOIN dbo.App_Dispatch d ON d.idMensaje=m.idMensaje WHERE m.idContacto=@contact AND m.idDireccion=2 ORDER BY m.idMensaje DESC',
            { contact },
          )
        ).recordset[0].markup;
        assert.match(markup, /pf:/);
        assert.equal(chat.client.calls.length, channel === 1 ? 6 : 7);
      });
    } finally {
      await close();
    }
  });

  test(`${label}: el correo existente queda en Pendientes hasta la confirmación del operador`, async () => {
    try {
      await rollbackTest(async (db) => {
        const existing = scenario(3);
        const lead = await createExisting(db, existing);
        const chat = scenario(channel);
        await send(db, chat, 'Hola');
        const provisional = await contactOf(db, chat);
        await send(db, chat, lead.name);
        await send(db, chat, lead.email);
        assert.match(lastText(chat), /identidad necesita revisión/);
        const state = (
          await query(
            db,
            'SELECT step,idSolicitud id FROM dbo.App_Onboarding WHERE idContacto=@contact',
            { contact: provisional },
          )
        ).recordset[0];
        assert.equal(state.step, 'review');
        assert.ok(
          (await listPending()).some((item) => item.type === 'identity' && item.id === -state.id),
        );
        const inquiry = (await listInquiries(db)).find((row) => row.id === -state.id);
        assert.equal(inquiry.email, lead.email);
        assert.equal(inquiry.status, 'Revisar identidad');
        assert.equal(
          (
            await query(db, 'SELECT correo FROM dbo.Contacto WHERE idContacto=@contact', {
              contact: provisional,
            })
          ).recordset[0].correo,
          null,
        );
        assert.equal(
          (
            await query(db, 'SELECT telefono FROM dbo.Contacto WHERE idContacto=@contact', {
              contact: lead.contact,
            })
          ).recordset[0].telefono,
          existing.phone,
        );
        await send(db, chat, 'Sí, soy yo');
        assert.match(lastText(chat), /identidad necesita revisión/);
        if (channel === 3) {
          await assert.rejects(
            () =>
              completeOnboarding(state.id, {
                name: lead.name,
                email: lead.email,
                phone: chat.phone,
                role: 1,
                beneficiary: lead.name,
                isStudent: true,
                plan: inquiry.plan,
                consent: true,
              }),
            /otro chat vinculado/,
          );
        } else {
          const result = await completeOnboarding(state.id, {
            name: lead.name,
            email: lead.email,
            phone: chat.phone,
            role: 1,
            beneficiary: lead.name,
            isStudent: true,
            plan: inquiry.plan,
            consent: true,
          });
          assert.equal(result.participationId, lead.id);
          assert.equal(await contactOf(db, chat), lead.contact);
          assert.equal(
            (
              await query(
                db,
                'SELECT COUNT(*) n FROM dbo.AutorizacionContacto WHERE idContacto=@contact AND idCanal=1 AND idEstadoAutorizacion=1',
                { contact: lead.contact },
              )
            ).recordset[0].n,
            1,
          );
          assert.ok(
            !(await listPending()).some(
              (item) => item.type === 'identity' && item.id === -state.id,
            ),
          );
          assert.equal(
            (
              await query(db, 'SELECT COUNT(*) n FROM dbo.Lead WHERE idContacto=@contact', {
                contact: lead.contact,
              })
            ).recordset[0].n,
            1,
          );
          await send(db, chat, 'Hola, ya me registré en LaPreDigital');
          await flush(db, chat, lead.contact);
          assert.ok(
            chat.client.calls.some((payload) =>
              /Qué carrera/.test(payload.interactive?.body?.text || ''),
            ),
          );
        }
      });
    } finally {
      await close();
    }
  });
}
