import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';
import { app } from '../app.mjs';
import { close, query, rollbackTest } from '../db.mjs';
import { normalizePhone, registerLanding } from '../public/landing.mjs';

const count = async (db, sql, params) => (await query(db, sql, params)).recordset[0].n;
const uniqueEmail = (label) => `${label}-${Date.now()}@example.test`;

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
      assert.deepEqual(result, { registered: true });
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
      assert.deepEqual(result, { registered: true });
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

test('landing: el campo trampa descarta el envío sin escribir en la base', async () => {
  const email = uniqueEmail('landing-bot');
  try {
    await rollbackTest(async (db) => {
      await registerLanding({
        name: 'Bot Landing',
        email,
        phone: '+51900000003',
        role: 1,
        channels: [1],
        website: 'https://spam.example',
      });
      assert.equal(
        await count(db, 'SELECT COUNT(*) n FROM dbo.Contacto WHERE correo=@email', { email }),
        0,
      );
    });
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
