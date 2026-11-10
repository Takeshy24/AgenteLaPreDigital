import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createSession, getSession } from '../contracts/stripe.mjs';

const originalKey = process.env.STRIPE_SECRET_KEY;
const originalFetch = globalThis.fetch;
after(() => {
  if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = originalKey;
  globalThis.fetch = originalFetch;
});

test('Stripe de prueba: usa importe del servidor y rechaza claves de producción', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_live_unsafe';
  await assert.rejects(() => createSession({ amount: 39.9 }), /de prueba/);
  process.env.STRIPE_SECRET_KEY = 'sk_test_example';
  globalThis.fetch = async (_url, options) => {
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('line_items[0][price_data][currency]'), 'pen');
    assert.equal(body.get('line_items[0][price_data][unit_amount]'), '3990');
    assert.equal(body.get('metadata[caseId]'), '7');
    assert.equal(body.get('metadata[contractId]'), '11');
    return {
      ok: true,
      json: async () => ({ livemode: false, url: 'https://checkout.stripe.com/test' }),
    };
  };
  const session = await createSession({
    caseId: 7,
    contractId: 11,
    amount: 39.9,
    plan: 'Ruta UNT',
    origin: 'http://127.0.0.1:3067',
  });
  assert.equal(session.url, 'https://checkout.stripe.com/test');
  await assert.rejects(() => getSession('fake_session'), /Sesión Stripe inválida/);
});
