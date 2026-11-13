import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAnalysis } from '../agent/ollama.mjs';
import { close, query, rollbackTest } from '../db.mjs';
import { dispatchMessage } from '../integrations/dispatch.mjs';
import { telegramClient, TelegramError } from '../integrations/telegram-client.mjs';
import { createLead } from '../leads/service.mjs';
import { recordIncoming } from '../messages/service.mjs';
import { prepareProposal } from '../proposals/service.mjs';
test('Telegram: timeout es ambiguo; rechazo explícito no se confunde con entrega', async () => {
  await assert.rejects(
    () =>
      telegramClient('fake', async () => {
        throw new Error('timeout');
      }).call('sendMessage', {}),
    (error) => error.uncertain === true,
  );
  await assert.rejects(
    () =>
      telegramClient('fake', async () => ({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, error_code: 400 }),
      })).call('sendMessage', {}),
    (error) => error.uncertain === false,
  );
});
test('Ollama: rechaza datos sin evidencia, precios convertidos a Compra y tarifas inexistentes', () => {
  const result = validateAnalysis(
    {
      level: 3,
      retraction: false,
      action: 'handoff',
      tariffId: 999,
      fields: [{ field: 'career', value: 'Medicina', quote: 'Inventado' }],
    },
    '¿Cuánto cuesta el plan?',
    [],
  );
  assert.equal(result.level, 2);
  assert.equal(result.action, 'catalog');
  assert.equal(result.tariffId, null);
  assert.deepEqual(result.fields, []);
});
test('outbox: un envío incierto no se reintenta ni se registra como entregado', async () => {
  try {
    await rollbackTest(async (db) => {
      const suffix = Date.now();
      const contact = await createLead({
        name: 'Telegram ' + suffix,
        email: 'telegram-' + suffix + '@example.test',
        phone: '+51912345678',
        role: 1,
        channel: 1,
        communicationChannel: 2,
        consent: true,
      });
      const incoming = await recordIncoming(contact.id, {
        text: 'Quiero contratar',
        channel: 3,
        level: 3,
      });
      const tariff = (await query(db, 'SELECT TOP 1 idPlanTarifa id FROM dbo.PlanTarifa'))
        .recordset[0];
      const proposal = await prepareProposal(contact.id, {
        tariff: tariff.id,
        replyTo: incoming.id,
        channel: 3,
        justification: 'Plan solicitado por el contacto.',
      });
      await query(
        db,
        'INSERT dbo.App_TelegramChat(idContacto,chatId) SELECT l.idContacto,@chat FROM dbo.Lead l JOIN dbo.LeadCaso lc ON lc.idLead=l.idLead WHERE lc.idLeadCaso=@id',
        { id: contact.id, chat: 'test-' + suffix },
      );
      let calls = 0;
      const client = {
        call: async () => {
          calls++;
          throw new TelegramError('Timeout', true);
        },
      };
      await dispatchMessage(proposal.messageId, client);
      await dispatchMessage(proposal.messageId, client);
      assert.equal(calls, 1);
      assert.equal(
        (
          await query(db, 'SELECT idEstadoEntrega FROM dbo.Mensaje WHERE idMensaje=@id', {
            id: proposal.messageId,
          })
        ).recordset[0].idEstadoEntrega,
        1,
      );
    });
  } finally {
    await close();
  }
});

test('el agente usa OpenAI y pasa a Ollama si OpenAI falla', async () => {
  const { analyzeMessage, providerOrder } = await import('../agent/ollama.mjs');
  const saved = { ...process.env };
  process.env.OPENAI_API_KEY = 'sk-prueba';
  process.env.OPENAI_ENABLED = 'true';
  process.env.OLLAMA_ENABLED = 'true';
  const tariffs = [{ idPlanTarifa: 2, plan: 'Meta UNT', modalidad: 'Mensual', precio: 79.9 }];
  const output = {
    level: 2,
    retraction: false,
    action: 'catalog',
    tariffId: null,
    fields: [],
    understood: true,
    needsGuardian: false,
    guardian: null,
  };
  const calls = [];
  const fetcher = (openaiOk) => async (url, init) => {
    calls.push(String(url));
    if (String(url).includes('openai')) {
      assert.equal(JSON.parse(init.body).response_format.type, 'json_schema');
      return openaiOk
        ? {
            ok: true,
            json: async () => ({ choices: [{ message: { content: JSON.stringify(output) } }] }),
          }
        : { ok: false, status: 500, json: async () => ({ error: { message: 'caído' } }) };
    }
    return { ok: true, json: async () => ({ message: { content: JSON.stringify(output) } }) };
  };
  try {
    assert.deepEqual(providerOrder(), ['openai', 'ollama']);
    const primary = await analyzeMessage('¿Cuánto cuesta Meta UNT?', tariffs, {
      fetcher: fetcher(true),
      context: { documents: [] },
    });
    assert.equal(primary.provider, 'openai');
    assert.equal(calls.length, 1);
    const fallback = await analyzeMessage('¿Cuánto cuesta Meta UNT?', tariffs, {
      fetcher: fetcher(false),
      context: { documents: [] },
    });
    assert.equal(fallback.provider, 'ollama');
    assert.match(fallback.fallbackReason, /openai: OpenAI respondió 500/);
    process.env.OPENAI_API_KEY = '';
    assert.deepEqual(providerOrder(), ['ollama']);
  } finally {
    process.env = saved;
  }
});
