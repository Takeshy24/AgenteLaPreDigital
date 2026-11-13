import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { app } from '../app.mjs';
import { close } from '../db.mjs';
import { loginAdmin } from '../test-support/login.mjs';
test('HTTP: lectura real, entradas inválidas y bloqueo de origen externo', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const fetch = await loginAdmin(url);
    const health = await fetch(url + '/api/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');
    const bootstrap = await fetch(url + '/api/bootstrap');
    assert.equal(bootstrap.status, 200);
    const data = await bootstrap.json();
    assert.ok(Array.isArray(data.leads));
    assert.ok(data.tariffs.length > 0);
    assert.equal(
      (
        await fetch(url + '/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
      400,
    );
    assert.equal(
      (await fetch(url + '/api/bootstrap', { headers: { Origin: 'https://otro-sitio.example' } }))
        .status,
      403,
    );
    assert.equal(
      (await fetch(url + '/api/leads', { method: 'POST', body: 'nombre=prueba' })).status,
      415,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await close();
  }
});
