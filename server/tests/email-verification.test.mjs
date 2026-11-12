import assert from 'node:assert/strict';
import test from 'node:test';
import { close, query, rollbackTest } from '../db.mjs';
import { integrationConfig } from '../integrations/config.mjs';
import { createTelegramLink, hashCode } from '../integrations/service.mjs';
import { sendEmail, verifySmtp } from '../integrations/mailer.mjs';
import { getChat, saveLink, useLink } from '../integrations/repository.mjs';
import { createLead } from '../leads/service.mjs';
import { createChatContact } from '../onboarding/repository.mjs';
import { registerLanding, registrationEmail, telegramEmail } from '../public/landing.mjs';

process.env.SMTP_PASSWORD = ''; // las pruebas nunca envían correo real
process.env.WHATSAPP_PUBLIC_NUMBER = ''; // los comprobantes exactos no dependen del .env
const count = async (db, sql, params) => (await query(db, sql, params)).recordset[0].n;
const uniqueEmail = (label) => `${label}-${Date.now()}@example.test`;

function withEnv(values, work) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  return work().finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('SMTP: la clave de aplicación de Google se acepta con espacios y el remitente es opcional', () => {
  const previous = { ...process.env };
  process.env.SMTP_USER = ' alguien@gmail.com ';
  process.env.SMTP_PASSWORD = 'abcd efgh ijkl mnop';
  delete process.env.SMTP_FROM;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  const { smtp } = integrationConfig();
  assert.equal(smtp.user, 'alguien@gmail.com');
  assert.equal(smtp.password, 'abcdefghijklmnop');
  assert.equal(smtp.host, 'smtp.gmail.com');
  assert.equal(smtp.port, 465);
  assert.equal(smtp.from, '');
  for (const key of ['SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'SMTP_HOST', 'SMTP_PORT']) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
});

test('sendEmail usa el remitente configurado y falla si el servidor rechaza al destinatario', async () => {
  await withEnv(
    { SMTP_USER: 'cuenta@gmail.com', SMTP_FROM: 'LaPreDigital <cuenta@gmail.com>' },
    async () => {
      let sent;
      const accepted = await sendEmail(
        { to: 'persona@example.test', subject: 'Hola', text: 'texto', html: '<p>texto</p>' },
        {
          transport: {
            sendMail: async (message) => {
              sent = message;
              return { messageId: '<id-1>', rejected: [] };
            },
          },
        },
      );
      assert.equal(accepted.messageId, '<id-1>');
      assert.equal(sent.from, 'LaPreDigital <cuenta@gmail.com>');
      assert.equal(sent.to, 'persona@example.test');
      await assert.rejects(
        sendEmail(
          { to: 'rechazado@example.test', subject: 'Hola', text: 'texto' },
          {
            transport: {
              sendMail: async () => ({ messageId: '<id-2>', rejected: ['rechazado@example.test'] }),
            },
          },
        ),
        /rechazó al destinatario/,
      );
    },
  );
});

test('el correo de verificación contiene solo el enlace, vigencia y aviso, sin datos del contacto', () => {
  const message = telegramEmail('https://t.me/bot_de_prueba?start=CODIGO_DE_PRUEBA_123');
  assert.match(message.text, /https:\/\/t\.me\/bot_de_prueba\?start=CODIGO_DE_PRUEBA_123/);
  assert.match(message.text, /10 minutos/);
  assert.match(message.html, /href="https:\/\/t\.me\/bot_de_prueba\?start=CODIGO_DE_PRUEBA_123"/);
  assert.doesNotMatch(message.text + message.html, /@example|Rosa|nombre/i);
});

test('landing: un correo ya registrado recibe el enlace de Telegram por correo, una vez cada 10 minutos', async () => {
  const email = uniqueEmail('landing-correo');
  try {
    await withEnv({ TELEGRAM_BOT_USERNAME: 'bot_de_prueba' }, () =>
      rollbackTest(async (db) => {
        await registerLanding(
          {
            name: 'Titular Del Correo',
            email,
            phone: '+51911000111',
            role: 3,
            beneficiaryName: 'Hijo Del Titular Correo',
            channels: [2],
          },
          { send: null },
        );
        const sent = [];
        const send = async (message) => sent.push(message);
        const again = {
          name: 'Quien Escribe',
          email: email.toUpperCase(),
          phone: '+51922000222',
          role: 2,
          beneficiaryName: 'Estudiante Inventado',
          channels: [1, 2],
          telegram: true,
        };
        const first = await registerLanding(again, { send });
        assert.deepEqual(first, { registered: true });
        assert.equal(sent.length, 1);
        assert.equal(sent[0].to, email);
        assert.match(sent[0].text, /https:\/\/t\.me\/bot_de_prueba\?start=[A-Za-z0-9_-]{20,}/);
        assert.deepEqual(await registerLanding(again, { send }), { registered: true });
        assert.equal(sent.length, 1);
        assert.equal(
          await count(
            db,
            `SELECT COUNT(*) n FROM dbo.AutorizacionContacto a JOIN dbo.Contacto c ON c.idContacto=a.idContacto
            WHERE c.correo=@email AND a.idEstadoAutorizacion=1`,
            { email },
          ),
          1,
        );
        assert.equal(
          await count(
            db,
            `SELECT COUNT(*) n FROM dbo.Lead l JOIN dbo.Contacto c ON c.idContacto=l.idContacto WHERE c.correo=@email`,
            { email },
          ),
          1,
        );
        assert.equal(
          await count(
            db,
            `SELECT COUNT(*) n FROM dbo.App_TelegramLink t JOIN dbo.Contacto c ON c.idContacto=t.idContacto
            WHERE c.correo=@email AND t.usedAt IS NULL`,
            { email },
          ),
          1,
        );
      }),
    );
  } finally {
    await close();
  }
});

test('landing: si el envío del correo falla, el formulario responde igual y no se pierde la solicitud', async () => {
  const email = uniqueEmail('landing-correo-falla');
  try {
    await withEnv({ TELEGRAM_BOT_USERNAME: 'bot_de_prueba' }, () =>
      rollbackTest(async (db) => {
        const form = {
          name: 'Titular Falla',
          email,
          phone: '+51933000333',
          role: 1,
          channels: [2],
        };
        await registerLanding(form, { send: null });
        const failing = async () => {
          throw new Error('SMTP caído');
        };
        const result = await registerLanding(
          { ...form, name: 'Otra Persona', telegram: true },
          { send: failing },
        );
        assert.deepEqual(result, { registered: true });
        assert.equal(
          await count(
            db,
            "SELECT COUNT(*) n FROM dbo.App_PublicInquiry WHERE correo=@email AND estado=N'Revisar identidad'",
            { email },
          ),
          1,
        );
      }),
    );
  } finally {
    await close();
  }
});

test('vínculo: un enlace verificado reemplaza al contacto provisional de un chat que escribió /start sin código', async () => {
  try {
    await withEnv({ TELEGRAM_BOT_USERNAME: 'bot_de_prueba' }, () =>
      rollbackTest(async (db) => {
        const lead = await createLead({
          name: 'Contacto Verificado',
          email: uniqueEmail('vinculo-verificado'),
          phone: '+51944000444',
          role: 1,
          channel: 1,
          communicationChannel: 2,
          consent: true,
        });
        const chatId = String(Date.now());
        const provisional = await createChatContact(db, chatId);
        await saveLink(db, lead.contact, hashCode('codigo-de-prueba'));
        const linked = await useLink(db, hashCode('codigo-de-prueba'), chatId);
        assert.equal(Number(linked), Number(lead.contact));
        assert.equal(Number((await getChat(db, chatId)).idContacto), Number(lead.contact));
        assert.notEqual(Number(provisional), Number(lead.contact));
      }),
    );
  } finally {
    await close();
  }
});

test('vínculo: un chat ya ligado a un contacto con datos no puede ser reasignado por otro enlace', async () => {
  try {
    await rollbackTest(async (db) => {
      const make = (label) =>
        createLead({
          name: `Contacto ${label}`,
          email: uniqueEmail(`vinculo-${label}`),
          phone: '+51955000555',
          role: 1,
          channel: 1,
          communicationChannel: 2,
          consent: true,
        });
      const first = await make('Uno');
      const second = await make('Dos');
      const chatId = String(Date.now());
      await saveLink(db, first.contact, hashCode('enlace-uno'));
      assert.equal(
        Number(await useLink(db, hashCode('enlace-uno'), chatId)),
        Number(first.contact),
      );
      await saveLink(db, second.contact, hashCode('enlace-dos'));
      assert.equal(await useLink(db, hashCode('enlace-dos'), chatId), null);
      assert.equal(Number((await getChat(db, chatId)).idContacto), Number(first.contact));
    });
  } finally {
    await close();
  }
});

test('createTelegramLink sigue exigiendo el usuario del bot', async () => {
  await withEnv({ TELEGRAM_BOT_USERNAME: '' }, async () => {
    await assert.rejects(createTelegramLink(1), /TELEGRAM_BOT_USERNAME/);
  });
});

test('verifySmtp comprueba credenciales sin enviar ningún mensaje y propaga el error de autenticación', async () => {
  await withEnv({ SMTP_USER: 'cuenta@gmail.com', SMTP_HOST: 'smtp.gmail.com' }, async () => {
    let sent = 0;
    const ok = await verifySmtp({
      transport: { verify: async () => true, sendMail: async () => (sent += 1) },
    });
    assert.deepEqual(ok, { host: 'smtp.gmail.com', user: 'cuenta@gmail.com' });
    assert.equal(sent, 0);
    await assert.rejects(
      verifySmtp({
        transport: {
          verify: async () => {
            throw new Error('Invalid login');
          },
        },
      }),
      /Invalid login/,
    );
  });
});

test('landing: un contacto nuevo que pide Telegram recibe el botón y también el enlace por correo, ambos con consentimiento', async () => {
  const email = uniqueEmail('landing-nuevo-correo');
  try {
    await withEnv({ TELEGRAM_BOT_USERNAME: 'bot_de_prueba' }, () =>
      rollbackTest(async (db) => {
        const sent = [];
        const result = await registerLanding(
          {
            name: 'Contacto Nuevo',
            email: email.toUpperCase(),
            phone: '+51966000666',
            role: 1,
            channels: [],
            telegram: true,
          },
          { send: async (message) => sent.push(message) },
        );
        assert.match(
          result.telegramUrl,
          /^https:\/\/t\.me\/bot_de_prueba\?start=[A-Za-z0-9_-]{20,}$/,
        );
        assert.equal(result.emailed, true);
        assert.equal(sent.length, 1);
        assert.equal(sent[0].to, email);
        assert.ok(sent[0].text.includes(result.telegramUrl));
        assert.equal(
          await count(
            db,
            `SELECT COUNT(*) n FROM dbo.App_TelegramLink t JOIN dbo.Contacto c ON c.idContacto=t.idContacto
            WHERE c.correo=@email AND t.consentimiento=1`,
            { email },
          ),
          1,
        );
        const without = await registerLanding(
          {
            name: 'Otro Nuevo',
            email: uniqueEmail('landing-nuevo-sin-correo'),
            phone: '+51966000667',
            role: 1,
            channels: [],
            telegram: true,
          },
          { send: null },
        );
        assert.equal(without.emailed, undefined);
        assert.ok(without.telegramUrl);
      }),
    );
  } finally {
    await close();
  }
});

test('A1: solo correo recibe confirmación, cumple el primer intento y no duplica el envío', async () => {
  try {
    await rollbackTest(async (db) => {
      const form = {
        name: `Estudiante Solo Correo ${Date.now()}`,
        email: uniqueEmail('solo-correo'),
        phone: '+51977000777',
        role: 1,
        channels: [2],
        telegram: false,
      };
      const sent = [];
      const send = async (message) => sent.push(message);
      assert.deepEqual(await registerLanding(form, { send }), { registered: true });
      assert.equal(sent.length, 1);
      assert.equal(sent[0].to, form.email);
      assert.match(sent[0].subject, /registro/);
      assert.doesNotMatch(sent[0].text, /t\.me|Telegram/);
      const { recordset } = await query(
        db,
        `
          SELECT lc.idEstadoParticipacion AS state, lc.idPrioridadActual AS priority,
                 COUNT(i.idIntento) AS attempts, COUNT(i.idMensajeEnvio) AS delivered
          FROM dbo.Contacto c
          JOIN dbo.Lead l ON l.idContacto = c.idContacto
          JOIN dbo.LeadCaso lc ON lc.idLead = l.idLead
          JOIN dbo.IntentoContacto i ON i.idLeadCaso = lc.idLeadCaso
          WHERE c.correo = @email
          GROUP BY lc.idEstadoParticipacion, lc.idPrioridadActual;
        `,
        { email: form.email },
      );
      assert.deepEqual(recordset, [{ state: 1, priority: 1, attempts: 7, delivered: 1 }]);
      assert.equal(
        await count(
          db,
          `SELECT COUNT(*) n FROM dbo.Mensaje m
           JOIN dbo.Contacto c ON c.idContacto = m.idContacto
           WHERE c.correo = @email AND m.idCanal = 2 AND m.idEstadoEntrega = 2`,
          { email: form.email },
        ),
        1,
      );
      await registerLanding(form, { send });
      assert.equal(sent.length, 1);
    });
  } finally {
    await close();
  }
});

test('la confirmación usa solo el enlace público y no envía correo sin autorización', async () => {
  try {
    await withEnv({ WHATSAPP_PUBLIC_NUMBER: '987654321' }, () =>
      rollbackTest(async () => {
        const message = registrationEmail();
        assert.match(message.text, /https:\/\/wa\.me\/51987654321/);
        assert.match(message.html, /Conversar en WhatsApp/);
        let sent = 0;
        await registerLanding(
          {
            name: `Estudiante Solo WhatsApp ${Date.now()}`,
            email: uniqueEmail('sin-autorizacion-correo'),
            phone: '+51988000888',
            role: 1,
            channels: [1],
          },
          { send: async () => sent++ },
        );
        assert.equal(sent, 0);
      }),
    );
  } finally {
    await close();
  }
});

test('A1: SMTP fallido conserva el registro y los siete intentos pendientes', async () => {
  try {
    await rollbackTest(async (db) => {
      const email = uniqueEmail('confirmacion-falla');
      const result = await registerLanding(
        {
          name: `Estudiante Correo Fallido ${Date.now()}`,
          email,
          phone: '+51999000999',
          role: 1,
          channels: [2],
        },
        {
          send: async () => {
            throw new Error('SMTP de prueba no disponible');
          },
        },
      );
      assert.deepEqual(result, { registered: true });
      assert.equal(
        await count(
          db,
          `SELECT COUNT(*) n FROM dbo.IntentoContacto i
           JOIN dbo.LeadCaso lc ON lc.idLeadCaso = i.idLeadCaso
           JOIN dbo.Lead l ON l.idLead = lc.idLead
           JOIN dbo.Contacto c ON c.idContacto = l.idContacto
           WHERE c.correo = @email AND i.idMensajeEnvio IS NULL AND i.omitido = 0`,
          { email },
        ),
        7,
      );
    });
  } finally {
    await close();
  }
});
