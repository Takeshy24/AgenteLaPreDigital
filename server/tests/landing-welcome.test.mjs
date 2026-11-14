import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { close, query, rollbackTest } from '../db.mjs';
import { registerLanding } from '../public/landing.mjs';
import { dispatchMessage, dispatchPending } from '../integrations/dispatch.mjs';
import { markDelivered, pendingMessages } from '../integrations/repository.mjs';
import { welcomeApproved } from '../integrations/welcome-approval.mjs';
import { welcomeTemplate } from '../integrations/welcome-rules.mjs';
import { integrationConfig } from '../integrations/config.mjs';
import { reviewFollowup } from '../followup/service.mjs';
import { saveConsent } from '../consents/service.mjs';

test.beforeEach((context) => {
  Object.assign(process.env, {
    SMTP_PASSWORD: '',
    WHATSAPP_ENABLED: 'true',
    WHATSAPP_TOKEN: randomUUID(),
    WHATSAPP_PHONE_NUMBER_ID: '123456',
    WHATSAPP_BUSINESS_ACCOUNT_ID: '987654',
    WHATSAPP_TEMPLATE_NAME: 'hello_world',
    WHATSAPP_WELCOME_TEMPLATE_NAME: 'bienvenida_prueba',
    WHATSAPP_WELCOME_TEMPLATE_LANGUAGE: 'es',
    WHATSAPP_WELCOME_TEMPLATE_PARAMETER: 'none',
  });
  context.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      data: [{ name: 'bienvenida_prueba', language: 'es', status: 'APPROVED' }],
    }),
  }));
});

const form = (channels = [1]) => ({
  name: `Alumno ${randomUUID()}`,
  email: `${randomUUID()}@example.test`,
  phone: '+51912345678',
  role: 1,
  channels,
  telegram: false,
});
async function first(db, email) {
  return (
    await query(
      db,
      `SELECT i.idMensajeEnvio id,m.textoMensaje text,m.idEstadoEntrega delivered,d.state,d.markup,lc.idLeadCaso participation,l.idContacto contact
FROM dbo.Contacto c JOIN dbo.Lead l ON l.idContacto=c.idContacto JOIN dbo.LeadCaso lc ON lc.idLead=l.idLead
JOIN dbo.IntentoContacto i ON i.idLeadCaso=lc.idLeadCaso LEFT JOIN dbo.Mensaje m ON m.idMensaje=i.idMensajeEnvio
LEFT JOIN dbo.App_Dispatch d ON d.idMensaje=m.idMensaje WHERE c.correo=@email AND i.numeroIntento=1`,
      { email },
    )
  ).recordset[0];
}
const client = () => {
  const calls = [];
  return {
    calls,
    send: async (payload) => {
      calls.push(payload);
      return `wamid.welcome-${calls.length}`;
    },
  };
};

for (const status of ['APPROVED', 'PENDING']) {
  test(`el ciclo completo del despachador usa la configuración WhatsApp con plantilla ${status}`, async (context) => {
    context.mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      json: async () => ({ data: [{ name: 'bienvenida_prueba', language: 'es', status }] }),
    }));
    try {
      await rollbackTest(async (db) => {
        const data = form();
        await registerLanding(data, { send: null });
        const whatsapp = client();
        const telegram = { call: async () => ({ message_id: 1 }) };
        await dispatchPending(telegram, { whatsapp });
        const message = await first(db, data.email);
        assert.equal(message.state, status === 'APPROVED' ? 'sent' : 'pending');
        assert.equal(message.delivered, 1);
        if (status === 'APPROVED')
          assert.ok(
            whatsapp.calls.some((payload) => payload.template?.name === 'bienvenida_prueba'),
          );
      });
    } finally {
      await close();
    }
  });
}

test('el despachador funciona con WhatsApp cuando Telegram está desactivado', async () => {
  const previous = process.env.TELEGRAM_ENABLED;
  process.env.TELEGRAM_ENABLED = 'false';
  try {
    await rollbackTest(async (db) => {
      const data = form();
      await registerLanding(data, { send: null });
      const whatsapp = client();
      await dispatchPending(null, { whatsapp });
      assert.equal((await first(db, data.email)).state, 'sent');
    });
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_ENABLED;
    else process.env.TELEGRAM_ENABLED = previous;
    await close();
  }
});

test('Meta: solo una plantilla aprobada, con el nombre e idioma correctos, habilita la bienvenida', async () => {
  const config = integrationConfig().whatsapp;
  for (const status of ['PENDING', 'REJECTED', 'PAUSED', 'DISABLED']) {
    assert.equal(
      await welcomeApproved(config, {
        force: true,
        fetcher: async () => ({
          ok: true,
          json: async () => ({
            data: [{ name: config.welcomeTemplateName, language: 'es', status }],
          }),
        }),
      }),
      false,
      status,
    );
  }
  assert.equal(
    await welcomeApproved(config, {
      force: true,
      fetcher: async () => ({
        ok: true,
        json: async () => ({
          data: [{ name: config.welcomeTemplateName, language: 'en_US', status: 'APPROVED' }],
        }),
      }),
    }),
    false,
  );
  assert.equal(welcomeTemplate({ ...config, welcomeTemplateName: 'hello_world' }), null);
});

test('al registrarse prepara una bienvenida una sola vez y utiliza el intento inicial sin otro mensaje genérico', async () => {
  try {
    await rollbackTest(async (db) => {
      const data = form();
      const receipt = await registerLanding(data, { send: null });
      assert.equal(receipt.whatsappWelcome, 'queued');
      const message = await first(db, data.email);
      assert.match(message.text, /Gracias por registrarte en LaPreDigital/);
      assert.equal(message.delivered, 1);
      await reviewFollowup({ canSend: (channel) => channel === 1 });
      const outgoing = await query(
        db,
        'SELECT COUNT(*) n FROM dbo.Mensaje WHERE idContacto=@contact AND idDireccion=2',
        { contact: message.contact },
      );
      assert.equal(outgoing.recordset[0].n, 1);
      await registerLanding(data, { send: null });
      assert.equal((await first(db, data.email)).id, message.id);
      const whatsapp = client();
      const sent = await dispatchMessage(message.id, null, { whatsapp });
      assert.equal(sent.sent, true);
      assert.equal(whatsapp.calls[0].type, 'template');
      assert.equal(whatsapp.calls[0].template.name, 'bienvenida_prueba');
      assert.equal(whatsapp.calls[0].template.language.code, 'es');
      assert.equal(whatsapp.calls[0].template.components, undefined);
      assert.equal(
        (await first(db, data.email)).delivered,
        1,
        'La aceptación de Meta todavía no confirma la entrega',
      );
      await markDelivered(db, message.id);
      assert.equal((await first(db, data.email)).delivered, 2);
      await dispatchMessage(message.id, null, { whatsapp });
      assert.equal(whatsapp.calls.length, 1);
    });
  } finally {
    await close();
  }
});

test('sin plantilla o con aprobación pendiente conserva la bienvenida y no llama al envío de Meta', async (context) => {
  try {
    await rollbackTest(async (db) => {
      process.env.WHATSAPP_WELCOME_TEMPLATE_NAME = '';
      const data = form();
      const receipt = await registerLanding(data, { send: null });
      assert.equal(receipt.whatsappWelcome, 'waiting-template');
      const message = await first(db, data.email);
      assert.ok(!(await pendingMessages(db, [1])).some((row) => row.id === message.id));
      const whatsapp = client();
      assert.equal((await dispatchMessage(message.id, null, { whatsapp })).sent, false);
      process.env.WHATSAPP_WELCOME_TEMPLATE_NAME = 'bienvenida_prueba';
      const pending = context.mock.method(globalThis, 'fetch', async () => ({
        ok: true,
        json: async () => ({
          data: [{ name: 'bienvenida_prueba', language: 'es', status: 'PENDING' }],
        }),
      }));
      assert.equal((await dispatchMessage(message.id, null, { whatsapp })).sent, false);
      assert.equal(whatsapp.calls.length, 0);
      assert.equal((await first(db, data.email)).state, 'pending');
      assert.ok(pending.mock.calls.length > 0);
      process.env.WHATSAPP_TOKEN = randomUUID();
      context.mock.method(globalThis, 'fetch', async () => ({
        ok: true,
        json: async () => ({
          data: [{ name: 'bienvenida_prueba', language: 'es', status: 'APPROVED' }],
        }),
      }));
      assert.equal((await dispatchMessage(message.id, null, { whatsapp })).sent, true);
      assert.equal(whatsapp.calls.length, 1);
    });
  } finally {
    await close();
  }
});

test('sin autorización de WhatsApp no prepara una bienvenida por ese canal', async () => {
  try {
    await rollbackTest(async (db) => {
      const data = form([2]);
      await registerLanding(data, { send: null });
      assert.equal((await first(db, data.email)).id, null);
    });
  } finally {
    await close();
  }
});

test('una revocación antes del despacho bloquea la bienvenida aunque Meta haya aprobado la plantilla', async () => {
  try {
    await rollbackTest(async (db) => {
      const data = form();
      await registerLanding(data, { send: null });
      const message = await first(db, data.email);
      await saveConsent(message.participation, { channel: 1, granted: false, version: 'test' });
      const whatsapp = client();
      await dispatchMessage(message.id, null, { whatsapp });
      assert.equal(whatsapp.calls.length, 0);
      assert.equal((await first(db, data.email)).delivered, 3);
    });
  } finally {
    await close();
  }
});

test('un rechazo de Meta no elimina el registro ni afirma que se entregó la bienvenida', async () => {
  try {
    await rollbackTest(async (db) => {
      const data = form();
      const receipt = await registerLanding(data, { send: null });
      const message = await first(db, data.email);
      const whatsapp = {
        send: async () => {
          const error = new Error('Meta no permite este envío');
          error.uncertain = false;
          throw error;
        },
      };
      assert.equal(receipt.recorded, true);
      assert.equal((await dispatchMessage(message.id, null, { whatsapp })).sent, false);
      assert.equal((await first(db, data.email)).delivered, 3);
    });
  } finally {
    await close();
  }
});

const pendingApproval = (context) =>
  context.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      data: [{ name: 'bienvenida_prueba', language: 'es', status: 'PENDING' }],
    }),
  }));

test('sin plantilla aprobada y con correo autorizado, la bienvenida sale por correo y no por WhatsApp', async (context) => {
  try {
    await rollbackTest(async (db) => {
      pendingApproval(context);
      const data = form([1, 2]);
      const receipt = await registerLanding(data, {
        send: async () => ({ messageId: 'correo-registro' }),
      });
      assert.equal(receipt.whatsappWelcome, 'email');
      const attempt = (
        await query(
          db,
          `SELECT m.idCanal channel, m.idEstadoEntrega delivered FROM dbo.Contacto c
          JOIN dbo.Lead l ON l.idContacto=c.idContacto JOIN dbo.LeadCaso lc ON lc.idLead=l.idLead
          JOIN dbo.IntentoContacto i ON i.idLeadCaso=lc.idLeadCaso AND i.numeroIntento=1
          JOIN dbo.Mensaje m ON m.idMensaje=i.idMensajeEnvio WHERE c.correo=@email`,
          { email: data.email },
        )
      ).recordset[0];
      assert.deepEqual(attempt, { channel: 2, delivered: 2 });
    });
  } finally {
    await close();
  }
});

test('una bienvenida de WhatsApp sin aprobación pasa al correo y el correo de seguimiento se despacha', async (context) => {
  try {
    await rollbackTest(async (db) => {
      const data = form([1, 2]);
      await registerLanding(data, { send: null });
      const welcome = await first(db, data.email);
      assert.equal(welcome.state, 'pending');
      await query(
        db,
        'UPDATE dbo.IntentoContacto SET fechaProgramada=DATEADD(MINUTE,-1,DATEADD(HOUR,-5,SYSUTCDATETIME())) WHERE idLeadCaso=@id AND numeroIntento=1',
        { id: welcome.participation },
      );
      await reviewFollowup({ canSend: (channel) => channel === 2, welcomeReady: false });
      const old = (
        await query(db, 'SELECT idEstadoEntrega delivered FROM dbo.Mensaje WHERE idMensaje=@id', {
          id: welcome.id,
        })
      ).recordset[0];
      assert.equal(old.delivered, 3);
      const rerouted = await first(db, data.email);
      assert.notEqual(rerouted.id, welcome.id);
      const sentMail = [];
      const result = await dispatchMessage(rerouted.id, null, {
        mail: {
          send: async (mail) => {
            sentMail.push(mail);
            return { messageId: 'correo-seguimiento' };
          },
        },
      });
      assert.equal(result.sent, true);
      assert.equal(sentMail[0].to, data.email);
      assert.match(sentMail[0].subject, /Seguimiento/);
      assert.equal((await first(db, data.email)).delivered, 2);
    });
  } finally {
    await close();
  }
});
