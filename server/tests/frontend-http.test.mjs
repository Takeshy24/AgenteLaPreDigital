import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function frontendModule(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll(
    'import.meta.env',
    '({ VITE_API_URL: "" })',
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  return import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
}
test('frontend HTTP: una página HTML con estado 200 no se acepta como respuesta de la API', async () => {
  const { request } = await frontendModule('../../src/api.ts');
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response('<html>Servidor equivocado</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    await assert.rejects(
      () => request('/public/landing', 'POST', {}),
      /no devolvió una respuesta válida/,
    );
    globalThis.fetch = async () => Response.json({ registered: true, recorded: true });
    assert.deepEqual(await request('/public/landing', 'POST', {}), {
      registered: true,
      recorded: true,
    });
    globalThis.fetch = async () => Response.json({ error: 'No se pudo guardar' }, { status: 400 });
    await assert.rejects(() => request('/public/landing', 'POST', {}), /No se pudo guardar/);
  } finally {
    globalThis.fetch = original;
  }
});
test('comprobante: requiere confirmación de guardado y acepta solamente enlaces de los canales oficiales', async () => {
  const { confirmedReceipt } = await frontendModule('../../src/features/leads/landing-receipt.ts');
  for (const payload of [
    null,
    {},
    { error: 'Fallo' },
    { registered: true },
    { registered: false, recorded: false },
  ])
    assert.throws(() => confirmedReceipt(payload), /no confirmó el registro/);
  const valid = confirmedReceipt({
    registered: true,
    recorded: true,
    telegramUrl: 'https://t.me/bot_de_prueba?start=abc',
    whatsappUrl: 'https://wa.me/51987654321?text=Hola',
    telegramLinkExpires: true,
  });
  assert.match(valid.telegramUrl, /^https:\/\/t.me/);
  assert.match(valid.whatsappUrl, /^https:\/\/wa.me/);
  assert.equal(valid.telegramLinkExpires, true);
  const forged = confirmedReceipt({
    registered: true,
    recorded: true,
    telegramUrl: 'javascript:alert(1)',
    whatsappUrl: 'https://otro.example',
    telegramLinkExpires: true,
  });
  assert.equal(forged.telegramUrl, '');
  assert.equal(forged.whatsappUrl, '');
  assert.equal(forged.telegramLinkExpires, false);
});
