import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';
import { app } from '../app.mjs';
import { close, query, rollbackTest } from '../db.mjs';
import { normalizePhone, registerLanding } from '../public/landing.mjs';
import { getWorkspace } from '../workspace/repository.mjs';

process.env.SMTP_PASSWORD = ''; // las pruebas nunca envían correo real
process.env.WHATSAPP_PUBLIC_NUMBER = ''; // los comprobantes exactos no dependen del .env
const count = async (db, sql, params) => (await query(db, sql, params)).recordset[0].n;
const uniqueEmail = (label) => `${label}-${Date.now()}@example.test`;

test('comprobante: siempre ofrece WhatsApp y Telegram tras guardar, aunque solo se autorice correo', async () => {
  const previousNumber = process.env.WHATSAPP_PUBLIC_NUMBER;
  process.env.WHATSAPP_PUBLIC_NUMBER = '987654321';
  try {
    await withBot('bot_de_prueba', () =>
      rollbackTest(async (db) => {
        for (const [index, option] of [
          { channels: [2], telegram: false },
          { channels: [1], telegram: false },
          { channels: [], telegram: true },
        ].entries()) {
          const email = uniqueEmail('ambos-canales-' + index);
          const result = await registerLanding(
            { name: 'Ambos canales ' + index, email, phone: '+51900000111', role: 1, ...option },
            { send: null },
          );
          assert.equal(result.recorded, true);
          assert.match(result.whatsappUrl, /^https:\/\/wa\.me\/51987654321\?/);
          assert.match(result.telegramUrl, /^https:\/\/t\.me\/bot_de_prueba\?start=/);
          assert.equal(result.telegramLinkExpires, true);
          const link = (
            await query(
              db,
              'SELECT t.consentimiento FROM dbo.App_TelegramLink t JOIN dbo.Contacto c ON c.idContacto=t.idContacto WHERE c.correo=@email',
              { email },
            )
          ).recordset[0];
          assert.equal(link.consentimiento, option.telegram);
          assert.ok((await getWorkspace()).leads.some((lead) => lead.email === email));
        }
      }),
    );
  } finally {
    if (previousNumber === undefined) delete process.env.WHATSAPP_PUBLIC_NUMBER;
    else process.env.WHATSAPP_PUBLIC_NUMBER = previousNumber;
    await close();
  }
});

test('comprobante: un fallo SQL se propaga y revierte el contacto en lugar de confirmar un registro inexistente', async () => {
  const email = uniqueEmail('fallo-sql');
  try {
    await assert.rejects(() =>
      registerLanding(
        {
          name: 'Fallo transaccional',
          email,
          phone: '+51900000112',
          role: 255,
          beneficiaryName: 'Beneficiario Fallo Transaccional',
          channels: [2],
          telegram: false,
        },
        { send: null },
      ),
    );
    const db = await (await import('../db.mjs')).pool();
    assert.equal(
      await count(db, 'SELECT COUNT(*) n FROM dbo.Contacto WHERE correo=@email', { email }),
      0,
    );
  } finally {
    await close();
  }
});

test('normalizePhone acepta móviles peruanos e internacionales y rechaza el resto', () => {
  assert.equal(normalizePhone('987 654 321'), '+51987654321');
  assert.equal(normalizePhone('+51 987-654-321'), '+51987654321');
  assert.equal(normalizePhone('+34612345678'), '+34612345678');
  assert.equal(normalizePhone('123'), null);
  assert.equal(normalizePhone('87654321'), null);
  assert.equal(normalizePhone('abc'), null);
});

test('landing: el estudiante crea contacto, beneficiario, LEAD, caso, participación y agenda', async () => {
  const email = uniqueEmail('landing-estudiante');
  try {
    await rollbackTest(async (db) => {
      const result = await registerLanding({
        name: 'Estudiante Landing Uno',
        email,
        phone: '+51987654321',
        role: 1,
        channels: [1, 2],
      });
      assert.equal(result.recorded, true);
      assert.equal(result.registered, true);
      const contact = (
        await query(db, 'SELECT idContacto id FROM dbo.Contacto WHERE correo=@email', { email })
      ).recordset[0];
      assert.equal(
        await count(
          db,
          'SELECT COUNT(*) n FROM dbo.AutorizacionContacto WHERE idContacto=@id AND idEstadoAutorizacion=1',
          contact,
        ),
        2,
      );
      const participation = (
        await query(
          db,
          `SELECT lc.idLeadCaso id, lc.idEstadoParticipacion state, lc.fechaInicioElegibilidad start,
            l.idCanalCaptacion capture, b.idContactoBeneficiario student
          FROM dbo.Lead l
          JOIN dbo.LeadCaso lc ON lc.idLead=l.idLead
          JOIN dbo.Beneficiario b ON b.idBeneficiario=l.idBeneficiario
          WHERE l.idContacto=@id`,
          contact,
        )
      ).recordset[0];
      assert.equal(participation.capture, 1);
      assert.equal(participation.state, 1);
      assert.ok(participation.start);
      assert.equal(participation.student, contact.id);
      assert.equal(
        await count(
          db,
          'SELECT COUNT(*) n FROM dbo.IntentoContacto WHERE idLeadCaso=@id',
          participation,
        ),
        7,
      );
    });
  } finally {
    await close();
  }
});

test('landing: reenviar el mismo formulario no duplica contacto, beneficiario, caso ni participación', async () => {
  const email = uniqueEmail('landing-madre');
  const form = {
    name: 'Madre Landing',
    email,
    phone: '+51912345678',
    role: 3,
    beneficiaryName: 'Hijo Landing Reenvio',
    channels: [2],
  };
  try {
    await rollbackTest(async (db) => {
      await registerLanding(form);
      await registerLanding({ ...form, beneficiaryName: '  hijo   landing  reenvio ' });
      assert.equal(
        await count(db, 'SELECT COUNT(*) n FROM dbo.Contacto WHERE correo=@email', { email }),
        1,
      );
      assert.equal(
        await count(
          db,
          "SELECT COUNT(*) n FROM dbo.Beneficiario WHERE nombreNormalizado=N'HIJO LANDING REENVIO'",
        ),
        1,
      );
      assert.equal(
        await count(
          db,
          `SELECT COUNT(*) n FROM dbo.LeadCaso lc
          JOIN dbo.Lead l ON l.idLead=lc.idLead
          JOIN dbo.Contacto c ON c.idContacto=l.idContacto WHERE c.correo=@email`,
          { email },
        ),
        1,
      );
    });
  } finally {
    await close();
  }
});

test('landing: un nombre ya registrado por otro contacto queda en revisión sin revelar identificadores', async () => {
  const first = uniqueEmail('landing-padre-a');
  const second = uniqueEmail('landing-padre-b');
  try {
    await rollbackTest(async (db) => {
      await registerLanding({
        name: 'Padre Uno',
        email: first,
        phone: '+51900000001',
        role: 2,
        beneficiaryName: 'Estudiante Homonimo Landing',
        channels: [1],
      });
      const result = await registerLanding({
        name: 'Madre Dos',
        email: second,
        phone: '+51900000002',
        role: 3,
        beneficiaryName: 'Estudiante Homonimo Landing',
        channels: [2],
      });
      assert.equal(result.recorded, true);
      assert.equal(result.registered, true);
      assert.equal(
        await count(
          db,
          "SELECT COUNT(*) n FROM dbo.Beneficiario WHERE nombreNormalizado=N'ESTUDIANTE HOMONIMO LANDING'",
        ),
        1,
      );
      const request = (
        await query(
          db,
          `SELECT s.idEstadoSolicitud state, s.idCanalCaptacion capture, s.textoSolicitud text
          FROM dbo.SolicitudProvisional s JOIN dbo.Contacto c ON c.idContacto=s.idContacto
          WHERE c.correo=@email`,
          { email: second },
        )
      ).recordset;
      assert.equal(request.length, 1);
      assert.equal(request[0].state, 1);
      assert.equal(request[0].capture, 1);
      assert.equal(
        await count(
          db,
          `SELECT COUNT(*) n FROM dbo.Lead l JOIN dbo.Contacto c ON c.idContacto=l.idContacto
          WHERE c.correo=@email`,
          { email: second },
        ),
        0,
      );
      await registerLanding({
        name: 'Madre Dos',
        email: second,
        phone: '+51900000002',
        role: 3,
        beneficiaryName: 'Estudiante Homonimo Landing',
        channels: [2],
      });
      assert.equal(
        await count(
          db,
          `SELECT COUNT(*) n FROM dbo.SolicitudProvisional s JOIN dbo.Contacto c ON c.idContacto=s.idContacto
          WHERE c.correo=@email`,
          { email: second },
        ),
        1,
      );
    });
  } finally {
    await close();
  }
});

test('landing: el campo trampa rechaza el envío sin fingir éxito ni escribir en la base', async () => {
  const email = uniqueEmail('landing-bot');
  try {
    await rollbackTest(async (db) => {
      await assert.rejects(
        () =>
          registerLanding({
            name: 'Bot Landing',
            email,
            phone: '+51900000003',
            role: 1,
            channels: [1],
            website: 'https://spam.example',
          }),
        (error) => error.status === 400,
      );
      assert.equal(
        await count(db, 'SELECT COUNT(*) n FROM dbo.Contacto WHERE correo=@email', { email }),
        0,
      );
    });
  } finally {
    await close();
  }
});

function withBot(username, work) {
  const previous = process.env.TELEGRAM_BOT_USERNAME;
  process.env.TELEGRAM_BOT_USERNAME = username;
  return work().finally(() => {
    if (previous === undefined) delete process.env.TELEGRAM_BOT_USERNAME;
    else process.env.TELEGRAM_BOT_USERNAME = previous;
  });
}

test('landing con Telegram: un contacto nuevo recibe un enlace de un solo uso sin consentimiento de canal', async () => {
  const email = uniqueEmail('landing-telegram');
  try {
    await withBot('bot_de_prueba', () =>
      rollbackTest(async (db) => {
        const result = await registerLanding({
          name: 'Estudiante Telegram',
          email,
          phone: '+51933333333',
          role: 1,
          channels: [],
          telegram: true,
        });
        assert.match(
          result.telegramUrl,
          /^https:\/\/t\.me\/bot_de_prueba\?start=[A-Za-z0-9_-]{20,}$/,
        );
        const contact = (
          await query(db, 'SELECT idContacto id FROM dbo.Contacto WHERE correo=@email', { email })
        ).recordset[0];
        assert.equal(
          await count(
            db,
            'SELECT COUNT(*) n FROM dbo.App_TelegramLink WHERE idContacto=@id AND usedAt IS NULL',
            contact,
          ),
          1,
        );
        assert.equal(
          await count(
            db,
            'SELECT COUNT(*) n FROM dbo.AutorizacionContacto WHERE idContacto=@id',
            contact,
          ),
          0,
        );
        const participation = (
          await query(
            db,
            `SELECT lc.idEstadoParticipacion state, lc.idMotivoSuspension reason,
              (SELECT COUNT(*) FROM dbo.IntentoContacto i WHERE i.idLeadCaso=lc.idLeadCaso) attempts
            FROM dbo.LeadCaso lc JOIN dbo.Lead l ON l.idLead=lc.idLead WHERE l.idContacto=@id`,
            contact,
          )
        ).recordset[0];
        assert.equal(participation.state, 2);
        assert.equal(participation.reason, 2);
        assert.equal(participation.attempts, 0);
      }),
    );
  } finally {
    await close();
  }
});

test('landing: sin bot no inventa enlaces y sin marcar Telegram ofrece enlace sin autorizar el canal', async () => {
  try {
    await withBot('', () =>
      rollbackTest(async () => {
        const noBot = await registerLanding({
          name: 'Sin Bot Configurado',
          email: uniqueEmail('landing-sin-bot'),
          phone: '+51944444444',
          role: 1,
          channels: [2],
          telegram: true,
        });
        assert.deepEqual(noBot, { registered: true, recorded: true, telegramLinkExpires: false });
      }),
    );
    await withBot('bot_de_prueba', () =>
      rollbackTest(async (db) => {
        const email = uniqueEmail('landing-no-pidio');
        const notRequested = await registerLanding({
          name: 'Sin Pedir Telegram',
          email,
          phone: '+51955555555',
          role: 1,
          channels: [2],
          telegram: false,
        });
        assert.equal(notRequested.recorded, true);
        assert.match(notRequested.telegramUrl, /^https:\/\/t\.me\/bot_de_prueba\?start=/);
        assert.equal(notRequested.telegramLinkExpires, true);
        const links = (
          await query(
            db,
            `SELECT t.consentimiento FROM dbo.App_TelegramLink t
            INNER JOIN dbo.Contacto c ON c.idContacto=t.idContacto WHERE c.correo=@email`,
            { email },
          )
        ).recordset;
        assert.deepEqual(links, [{ consentimiento: false }]);
      }),
    );
  } finally {
    await close();
  }
});

test('landing: un correo ya registrado no se vincula, no recibe enlace con código y queda en revisión', async () => {
  const email = uniqueEmail('landing-existente');
  try {
    await withBot('bot_de_prueba', () =>
      rollbackTest(async (db) => {
        await registerLanding({
          name: 'Rosa Titular',
          email,
          phone: '+51966666666',
          role: 3,
          beneficiaryName: 'Hijo De Rosa Titular',
          channels: [2],
        });
        const state = async () => ({
          consents: await count(
            db,
            `SELECT COUNT(*) n FROM dbo.AutorizacionContacto a JOIN dbo.Contacto c ON c.idContacto=a.idContacto
            WHERE c.correo=@email AND a.idEstadoAutorizacion=1`,
            { email },
          ),
          leads: await count(
            db,
            `SELECT COUNT(*) n FROM dbo.Lead l JOIN dbo.Contacto c ON c.idContacto=l.idContacto
            WHERE c.correo=@email`,
            { email },
          ),
          links: await count(
            db,
            `SELECT COUNT(*) n FROM dbo.App_TelegramLink t JOIN dbo.Contacto c ON c.idContacto=t.idContacto
            WHERE c.correo=@email`,
            { email },
          ),
        });
        const before = await state();
        const attacker = {
          name: 'Otra Persona',
          email: email.toUpperCase(),
          phone: '+51977777777',
          role: 2,
          beneficiaryName: 'Estudiante Inventado',
          channels: [1, 2],
          telegram: true,
        };
        const result = await registerLanding(attacker, { send: null });
        assert.deepEqual(result, {
          registered: true,
          recorded: true,
          telegramLinkExpires: false,
          telegramUrl: 'https://t.me/bot_de_prueba',
        });
        assert.deepEqual(await state(), before);
        await registerLanding(attacker, { send: null });
        const reviews = (
          await query(
            db,
            `SELECT estado, nombre, autorizaCorreo FROM dbo.App_PublicInquiry WHERE correo=@email`,
            { email },
          )
        ).recordset;
        assert.equal(reviews.length, 1);
        assert.equal(reviews[0].estado, 'Revisar identidad');
        const contact = (
          await query(db, 'SELECT nombreCompleto, telefono FROM dbo.Contacto WHERE correo=@email', {
            email,
          })
        ).recordset[0];
        assert.equal(contact.nombreCompleto, 'Rosa Titular');
        assert.equal(contact.telefono, '+51966666666');
      }),
    );
  } finally {
    await close();
  }
});

function send(port, { method, path, host, origin, body }) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: {
          Host: host,
          ...(origin ? { Origin: origin } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
      },
      (response) => {
        response.resume();
        response.on('end', () =>
          resolve({ status: response.statusCode, headers: response.headers }),
        );
      },
    );
    request.on('error', reject);
    request.end(body);
  });
}

test('HTTP por ngrok: solo /api/public es accesible y únicamente desde la landing autorizada', async () => {
  const saved = { public: process.env.PUBLIC_ORIGIN, landing: process.env.LANDING_ORIGINS };
  process.env.PUBLIC_ORIGIN = 'https://demo.ngrok-free.dev';
  process.env.LANDING_ORIGINS = 'https://demo.vercel.app';
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  const tunnel = 'demo.ngrok-free.dev';
  try {
    const preflight = await send(port, {
      method: 'OPTIONS',
      path: '/api/public/landing',
      host: tunnel,
      origin: 'https://demo.vercel.app',
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers['access-control-allow-origin'], 'https://demo.vercel.app');
    assert.match(preflight.headers['access-control-allow-headers'], /ngrok-skip-browser-warning/);

    const invalid = await send(port, {
      method: 'POST',
      path: '/api/public/landing',
      host: tunnel,
      origin: 'https://demo.vercel.app',
      body: '{}',
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.headers['access-control-allow-origin'], 'https://demo.vercel.app');

    const consoleAccess = await send(port, { method: 'GET', path: '/api/bootstrap', host: tunnel });
    assert.equal(consoleAccess.status, 403);
    const inquiries = await send(port, {
      method: 'GET',
      path: '/api/public-inquiries',
      host: tunnel,
    });
    assert.equal(inquiries.status, 403);
    const stranger = await send(port, {
      method: 'POST',
      path: '/api/public/landing',
      host: tunnel,
      origin: 'https://otro-sitio.example',
      body: '{}',
    });
    assert.equal(stranger.status, 403);
    const consoleFromLanding = await send(port, {
      method: 'GET',
      path: '/api/bootstrap',
      host: tunnel,
      origin: 'https://demo.vercel.app',
    });
    assert.equal(consoleFromLanding.status, 403);

    const statuses = [];
    for (let attempt = 0; attempt < 12; attempt++)
      statuses.push(
        (
          await send(port, {
            method: 'POST',
            path: '/api/public/landing',
            host: tunnel,
            origin: 'https://demo.vercel.app',
            body: '{}',
          })
        ).status,
      );
    assert.ok(statuses.includes(429), 'debe limitar los envíos repetidos desde la misma IP');
  } finally {
    for (const [name, key] of [
      ['public', 'PUBLIC_ORIGIN'],
      ['landing', 'LANDING_ORIGINS'],
    ]) {
      if (saved[name] === undefined) delete process.env[key];
      else process.env[key] = saved[name];
    }
    await new Promise((resolve) => server.close(resolve));
    await close();
  }
});

test('el correo automático enviado cumple el intento 1 y queda registrado por Correo', async () => {
  const sent = [];
  const send = async (mail) => sent.push(mail);
  const attempt = (db, email) =>
    query(
      db,
      `SELECT i.idMensajeEnvio sent, i.omitido skipped, m.idCanal channel, m.idEstadoEntrega delivery
       FROM dbo.Contacto c
       JOIN dbo.Lead l ON l.idContacto=c.idContacto
       JOIN dbo.LeadCaso lc ON lc.idLead=l.idLead
       JOIN dbo.IntentoContacto i ON i.idLeadCaso=lc.idLeadCaso
       LEFT JOIN dbo.Mensaje m ON m.idMensaje=i.idMensajeEnvio
       WHERE c.correo=@email AND i.numeroIntento=1`,
      { email },
    ).then((result) => result.recordset[0]);
  try {
    await withBot('bot_de_prueba', () =>
      rollbackTest(async (db) => {
        const withEmail = uniqueEmail('agenda-con-correo');
        await registerLanding(
          {
            name: 'Con Correo',
            email: withEmail,
            phone: '+51966666666',
            role: 1,
            channels: [2],
            telegram: true,
          },
          { send },
        );
        assert.equal(sent.length, 1);
        const first = await attempt(db, withEmail);
        assert.ok(first.sent);
        assert.equal(first.skipped, false);
        assert.equal(first.channel, 2);
        assert.equal(first.delivery, 2);
        const withoutEmail = uniqueEmail('agenda-sin-correo');
        await registerLanding(
          {
            name: 'Sin Correo',
            email: withoutEmail,
            phone: '+51977777777',
            role: 1,
            channels: [],
            telegram: true,
          },
          { send },
        );
        assert.ok(!(await attempt(db, withoutEmail))?.sent);
      }),
    );
  } finally {
    await close();
  }
});

test('landing: el comprobante incluye el enlace de WhatsApp solo si hay número configurado', async () => {
  const { whatsappUrl } = await import('../public/landing.mjs');
  const previous = process.env.WHATSAPP_PUBLIC_NUMBER;
  try {
    process.env.WHATSAPP_PUBLIC_NUMBER = '';
    assert.equal(whatsappUrl(), null);
    process.env.WHATSAPP_PUBLIC_NUMBER = '902319748';
    assert.match(whatsappUrl(), /^https:\/\/wa\.me\/51902319748\?text=Hola/);
    process.env.WHATSAPP_PUBLIC_NUMBER = '+51 902 319 748';
    assert.match(whatsappUrl(), /^https:\/\/wa\.me\/51902319748\?/);
    process.env.WHATSAPP_PUBLIC_NUMBER = '12';
    assert.equal(whatsappUrl(), null);
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_PUBLIC_NUMBER;
    else process.env.WHATSAPP_PUBLIC_NUMBER = previous;
  }
});
