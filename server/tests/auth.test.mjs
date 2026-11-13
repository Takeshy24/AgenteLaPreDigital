import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { get as httpGet } from 'node:http';
import { app } from '../app.mjs';
import { close, pool, query } from '../db.mjs';
import {
  authenticate,
  createSession,
  endSession,
  sessionUser,
  SESSION_DURATION,
} from '../auth/service.mjs';

test('sesiones: token aleatorio, rotación, cierre y vencimiento absoluto', () => {
  const user = { id: 1, username: 'admin' };
  const token = createSession(user, null, 1000);
  assert.equal(token.length, 43);
  assert.deepEqual(sessionUser(token, 1001), user);
  assert.equal(sessionUser('inventado'), null);
  const second = createSession(user, token, 2000);
  assert.notEqual(token, second);
  assert.equal(sessionUser(token, 2001), null);
  assert.equal(sessionUser(second, 2000 + SESSION_DURATION), null);
  const third = createSession(user);
  endSession(third);
  assert.equal(sessionUser(third), null);
});

test('SQL: existe únicamente admin, con hash; solo password autentica', async () => {
  try {
    const rows = (
      await query(
        await pool(),
        'SELECT id, usuario username, claveHash passwordHash FROM dbo.App_AdminUser',
      )
    ).recordset;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].username, 'admin');
    assert.match(rows[0].passwordHash, /^scrypt\$/);
    assert.notEqual(rows[0].passwordHash, 'password');
    assert.deepEqual(await authenticate('admin', 'password'), { id: 1, username: 'admin' });
    await assert.rejects(
      () => authenticate('admin', 'incorrecta'),
      (error) => error.status === 401,
    );
    await assert.rejects(
      () => authenticate('otro', 'password'),
      (error) => error.status === 401,
    );
  } finally {
    await close();
  }
});

test('HTTP: exige sesión en la API, conserva rutas públicas y revoca la cookie al salir', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(base + path, options);
  const post = (data, cookie) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(data),
  });
  try {
    assert.deepEqual(await (await request('/api/auth/session')).json(), { user: null });
    for (const path of [
      '/api/bootstrap',
      '/api/public-inquiries',
      '/api/knowledge/documents',
      '/api/knowledge/policy',
      '/api/kpis',
      '/api/kpis/report.pdf',
      '/api/participations/1',
    ])
      assert.equal((await request(path)).status, 401, path);
    assert.equal((await request('/api/health')).status, 200);
    assert.equal((await request('/api/public/landing', post({}))).status, 400);
    assert.equal(
      (await request('/api/auth/login', post({ username: 'admin', password: 'error' }))).status,
      401,
    );
    assert.equal(
      (
        await request(
          '/api/auth/login',
          post({ username: 'admin', password: 'password', extra: true }),
        )
      ).status,
      400,
    );
    const signed = await request(
      '/api/auth/login',
      post({ username: 'admin', password: 'password' }),
    );
    assert.equal(signed.status, 200);
    const body = await signed.json();
    assert.deepEqual(body, { user: { id: 1, username: 'admin' } });
    const header = signed.headers.get('set-cookie');
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=Strict/i);
    assert.match(header, /Path=\/api/i);
    const cookie = header.split(';')[0];
    assert.equal((await request('/api/bootstrap', { headers: { Cookie: cookie } })).status, 200);
    assert.equal(
      (await request('/api/bootstrap', { headers: { Cookie: cookie + 'x' } })).status,
      401,
    );
    assert.equal(
      (
        await request('/api/bootstrap', {
          headers: { Cookie: cookie, Origin: 'https://extra.example' },
        })
      ).status,
      403,
    );
    const tunnelStatus = await new Promise((resolve, reject) =>
      httpGet(base + '/api/auth/login', { headers: { Host: 'otro.example' } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      }).on('error', reject),
    );
    assert.equal(tunnelStatus, 403);
    const rotated = await request(
      '/api/auth/login',
      post({ username: 'admin', password: 'password' }, cookie),
    );
    const secondCookie = rotated.headers.get('set-cookie').split(';')[0];
    assert.notEqual(secondCookie, cookie);
    assert.equal((await request('/api/bootstrap', { headers: { Cookie: cookie } })).status, 401);
    const loggedOut = await request('/api/auth/logout', post({}, secondCookie));
    assert.equal(loggedOut.status, 200);
    assert.match(loggedOut.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
    assert.equal(
      (await request('/api/bootstrap', { headers: { Cookie: secondCookie } })).status,
      401,
    );
    assert.deepEqual(
      await (await request('/api/auth/session', { headers: { Cookie: secondCookie } })).json(),
      { user: null },
    );
    for (let index = 0; index < 10; index++) {
      const response = await request(
        '/api/auth/login',
        post({ username: 'otro', password: 'error' }),
      );
      if (index === 9) assert.equal(response.status, 429);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await close();
  }
});
