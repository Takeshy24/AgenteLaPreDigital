import assert from 'node:assert/strict';
import test from 'node:test';
import { close, query, rollbackTest } from '../db.mjs';
import {
  greeting,
  keyboard,
  nextKey,
  optionsFor,
  parseCallback,
  recommend,
  recommendationKeyboard,
} from '../agent/profile-flow.mjs';
import { acceptUpdate, pendingUpdates, saveLink } from '../integrations/repository.mjs';
import { dispatchMessage } from '../integrations/dispatch.mjs';
import { hashCode } from '../integrations/service.mjs';
import { processUpdate } from '../integrations/telegram.mjs';
import { actOnAnalysis } from '../agent/service.mjs';
import { getRequestedPlan } from '../agent/repository.mjs';
import { createLead } from '../leads/service.mjs';
import * as publicRepository from '../public/repository.mjs';
import { recordIncoming } from '../messages/service.mjs';

process.env.SMTP_PASSWORD = ''; // las pruebas nunca envían correo real

const tariffs = [
  { id: 1, plan: 'Ruta UNT', modalidad: 'Mensual', precio: 39.9 },
  { id: 2, plan: 'Meta UNT', modalidad: 'Mensual', precio: 79.9 },
  { id: 3, plan: 'Meta UNT', modalidad: 'Semestral', precio: 399.9 },
  { id: 4, plan: 'Meta UNT Plus', modalidad: 'Mensual', precio: 99.9 },
];

test('las opciones de presupuesto salen de las tarifas vigentes', () => {
  const options = optionsFor('budget', tariffs);
  assert.deepEqual(
    options.map((option) => option.label),
    ['Hasta S/ 40', 'Hasta S/ 80', 'S/ 100 o más'],
  );
  assert.deepEqual(
    options.map((option) => option.value),
    ['40', '80', '100'],
  );
});

test('los botones caben en el límite de Telegram y ofrecen otra respuesta salvo en presupuesto', () => {
  const career = keyboard(123456789, 'career', tariffs).flat();
  assert.ok(career.every((button) => Buffer.byteLength(button.callback_data) <= 64));
  assert.ok(career.some((button) => button.text === 'Otra respuesta'));
  assert.ok(career.some((button) => button.callback_data === 'pf:123456789:c:0'));
  assert.ok(
    !keyboard(1, 'budget', tariffs)
      .flat()
      .some((button) => button.text === 'Otra respuesta'),
  );
});

test('parseCallback acepta solo el formato propio', () => {
  assert.deepEqual(parseCallback('pf:57:c:2'), { participationId: 57, letter: 'c', index: '2' });
  assert.deepEqual(parseCallback('pf:57:t'), { participationId: 57, letter: 't', index: null });
  assert.deepEqual(parseCallback('pf:57:c:x'), { participationId: 57, letter: 'c', index: 'x' });
  for (const bad of ['case:5', 'pf:x:c:1', 'pf:5:z:1', 'pf:5:c:-1', '', undefined])
    assert.equal(parseCallback(bad), null);
});

test('la siguiente pregunta sigue el orden y se detiene cuando el perfil está completo', () => {
  assert.equal(nextKey({}), 'career');
  assert.equal(nextKey({ career: 'Derecho', availability: '', budget: null }), 'availability');
  assert.equal(nextKey({ career: 'Derecho', availability: '3 a 4 horas al día' }), 'budget');
  // Opcionales (tabla 3): cursos difíciles y postulaciones, una sola vez y solo si no se conocen.
  const core = { career: 'Derecho', availability: 'x', budget: 0 };
  assert.equal(nextKey(core), 'courses');
  assert.equal(nextKey({ ...core, asked: '2,6,7,3' }), 'applications');
  assert.equal(nextKey({ ...core, courses: 'Física' }), 'applications');
  assert.equal(nextKey({ ...core, asked: '3,4' }), null);
  assert.equal(nextKey({ ...core, courses: 'Física', applications: 'Postuló una vez' }), null);
});

test('la recomendación elige el plan mensual más completo que cabe y no inventa importes', () => {
  const profile = (budget) => ({ career: 'Derecho', availability: '3 a 4 horas al día', budget });
  assert.equal(recommend(profile(40), tariffs).tariff.plan, 'Ruta UNT');
  const meta = recommend(profile(80), tariffs);
  assert.equal(meta.tariff.plan, 'Meta UNT');
  assert.doesNotMatch(meta.text, /79\.90|399\.90/);
  assert.equal(recommend(profile(100), tariffs).tariff.plan, 'Meta UNT Plus');
  const none = recommend(profile(30), tariffs);
  assert.equal(none.tariff, null);
  assert.match(none.text, /Explora UNT/);
  assert.equal(recommendationKeyboard(9, none.tariff).flat().length, 1);
  assert.equal(recommendationKeyboard(9, meta.tariff).flat().length, 3);
});

test('el saludo usa el primer nombre y no menciona autorizar ni revocar', () => {
  assert.match(greeting('Ana María Torres'), /^¡Hola, Ana!/);
  assert.match(greeting(null), /^¡Hola!/);
  assert.doesNotMatch(greeting('Ana'), /autorizar|revocar/i);
});

function fakeClient() {
  const calls = [];
  return {
    calls,
    call: async (method, data) => {
      calls.push({ method, data });
      return method === 'sendMessage' ? { message_id: calls.length } : true;
    },
  };
}

async function setup(db, { consent }) {
  const suffix = Date.now() + Math.floor(Math.random() * 1000);
  const lead = await createLead({
    name: 'Estudiante Prueba',
    email: `perfil-${suffix}@example.test`,
    phone: '+51912345678',
    role: 1,
    channel: 1,
    communicationChannel: 2,
    consent: true,
  });
  const code = `codigo-${suffix}`;
  await saveLink(db, lead.contact, hashCode(code), consent);
  return { lead, code, chat: String(suffix), client: fakeClient(), sequence: suffix };
}

async function send(db, scenario, update) {
  scenario.sequence += 1;
  const full = { update_id: scenario.sequence, ...update(scenario.sequence) };
  await acceptUpdate(db, full);
  const item = (await pendingUpdates(db)).find((row) => row.updateId === full.update_id);
  await processUpdate(item, scenario.client);
  return full.update_id;
}
const text = (scenario, value) => (id) => ({
  message: {
    message_id: id,
    from: { id: 123, is_bot: false },
    chat: { id: scenario.chat, type: 'private' },
    text: value,
  },
});
const press = (scenario, data) => (id) => ({
  callback_query: {
    id: `cb-${id}`,
    from: { id: 123 },
    data,
    message: { message_id: id, chat: { id: scenario.chat, type: 'private' } },
  },
});

async function flush(db, scenario) {
  const pending = (
    await query(
      db,
      'SELECT idMensaje id FROM dbo.Mensaje WHERE idContacto=@contact AND idDireccion=2 AND idEstadoEntrega=1 ORDER BY idMensaje',
      { contact: scenario.lead.contact },
    )
  ).recordset;
  for (const message of pending) await dispatchMessage(message.id, scenario.client);
  return scenario.client.calls.filter((call) => call.method === 'sendMessage');
}

const outgoing = async (db, scenario) =>
  (
    await query(
      db,
      'SELECT m.idMensaje id, m.textoMensaje text, d.markup FROM dbo.Mensaje m LEFT JOIN dbo.App_Dispatch d ON d.idMensaje=m.idMensaje WHERE m.idContacto=@contact AND m.idDireccion=2 ORDER BY m.idMensaje',
      { contact: scenario.lead.contact },
    )
  ).recordset;

test('vincular con un enlace de formulario saluda, autoriza Telegram y hace la primera pregunta con botones', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: true });
      await send(db, scenario, text(scenario, `/start ${scenario.code}`));
      const [greetingMessage] = await outgoing(db, scenario);
      assert.match(greetingMessage.text, /^¡Hola, Estudiante!/);
      assert.match(greetingMessage.text, /¿Qué carrera te gustaría estudiar\?/);
      assert.doesNotMatch(greetingMessage.text, /autorizar|revocar/i);
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.AutorizacionContacto WHERE idContacto=@contact AND idCanal=3 AND idEstadoAutorizacion=1',
            { contact: scenario.lead.contact },
          )
        ).recordset[0].n,
        1,
      );
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.PreguntaPerfil WHERE idLeadCaso=@id AND idCampoPerfil=2',
            { id: scenario.lead.id },
          )
        ).recordset[0].n,
        1,
      );
      const [sent] = await flush(db, scenario);
      const buttons = sent.data.reply_markup.keyboard.flat();
      assert.ok(buttons.some((button) => button.text === 'Medicina Humana'));
      assert.equal(sent.data.reply_markup.one_time_keyboard, true);
      assert.ok(!('inline_keyboard' in sent.data.reply_markup));
    });
  } finally {
    await close();
  }
});

test('un enlace sin consentimiento saluda, pregunta una sola vez por la autorización y la registra con origen Chat', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: false });
      await send(db, scenario, text(scenario, `/start ${scenario.code}`));
      const auths = async () =>
        (
          await query(
            db,
            'SELECT idEstadoAutorizacion state, idOrigenAutorizacion origin FROM dbo.AutorizacionContacto WHERE idContacto=@contact AND idCanal=3',
            { contact: scenario.lead.contact },
          )
        ).recordset;
      const [greetingMessage, prompt] = await outgoing(db, scenario);
      assert.match(greetingMessage.text, /^¡Hola/);
      assert.match(prompt.text, /escribamos por Telegram/);
      assert.equal((await auths()).length, 0);
      const sent = await flush(db, scenario);
      assert.deepEqual(
        sent
          .at(-1)
          .data.reply_markup.inline_keyboard.flat()
          .map((button) => button.text),
        ['Sí, escríbanme', 'No, gracias'],
      );
      await send(db, scenario, press(scenario, `ok:${scenario.lead.id}:1`));
      assert.deepEqual(await auths(), [{ state: 1, origin: 3 }]);
      assert.match((await outgoing(db, scenario)).at(-1).text, /Te escribiremos por Telegram/);
      await send(db, scenario, press(scenario, `ok:${scenario.lead.id}:0`));
      assert.equal((await auths()).length, 1);
      await send(db, scenario, text(scenario, '¿Cuánto cuesta Ruta UNT?'));
      assert.equal(
        (await outgoing(db, scenario)).filter((row) => /escribamos por Telegram/.test(row.text))
          .length,
        1,
      );
    });
  } finally {
    await close();
  }
});

test('las respuestas con botones llenan el perfil una a una y terminan en una recomendación', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: true });
      const id = scenario.lead.id;
      await send(db, scenario, text(scenario, `/start ${scenario.code}`));
      await flush(db, scenario);

      await send(db, scenario, press(scenario, `pf:${id}:c:0`));
      const profile = async () =>
        (
          await query(
            db,
            `SELECT pb.carreraDeseada career, pb.disponibilidadEstudio availability, pc.presupuestoMensual budget
            FROM dbo.LeadCaso lc JOIN dbo.Lead l ON l.idLead=lc.idLead
            JOIN dbo.PerfilBeneficiario pb ON pb.idBeneficiario=l.idBeneficiario
            JOIN dbo.PerfilContacto pc ON pc.idContacto=l.idContacto WHERE lc.idLeadCaso=@id`,
            { id },
          )
        ).recordset[0];
      assert.equal((await profile()).career, 'Medicina Humana');
      let messages = await outgoing(db, scenario);
      assert.match(messages.at(-1).text, /¿Cuánto tiempo puedes dedicar a estudiar\?/);
      assert.ok(JSON.parse(messages.at(-1).markup).inline_keyboard.flat().length >= 4);
      assert.ok(
        scenario.client.calls.some(
          (call) => call.method === 'answerCallbackQuery' && call.data.text === '¡Listo!',
        ),
      );
      assert.ok(scenario.client.calls.some((call) => call.method === 'editMessageReplyMarkup'));

      const before = (await outgoing(db, scenario)).length;
      await send(db, scenario, press(scenario, `pf:${id}:c:1`));
      assert.equal((await profile()).career, 'Medicina Humana');
      assert.equal((await outgoing(db, scenario)).length, before);
      assert.equal(scenario.client.calls.at(-2).data.text, 'Ya la tengo anotada 😊');

      await send(db, scenario, press(scenario, `pf:${id}:a:1`));
      assert.equal((await profile()).availability, '3 a 4 horas al día');
      messages = await outgoing(db, scenario);
      assert.match(messages.at(-1).text, /¿Cuánto podrías invertir al mes/);

      await send(db, scenario, press(scenario, `pf:${id}:b:1`));
      assert.equal(Number((await profile()).budget), 80);
      messages = await outgoing(db, scenario);
      assert.match(
        messages.at(-1).text,
        /dos preguntas opcionales: ¿qué cursos se te hacen más difíciles\?/,
      );
      assert.ok(
        JSON.parse(messages.at(-1).markup)
          .inline_keyboard.flat()
          .some((button) => button.text === 'Ninguno en especial'),
      );
      await send(db, scenario, press(scenario, `pf:${id}:d:2`));
      messages = await outgoing(db, scenario);
      assert.match(messages.at(-1).text, /¿Ya postulaste antes a la UNT\?/);
      await send(db, scenario, press(scenario, `pf:${id}:e:0`));
      const needs = (
        await query(
          db,
          `SELECT (SELECT STRING_AGG(curso, ',') FROM dbo.BeneficiarioCursoDificil WHERE idBeneficiario=l.idBeneficiario) courses,
          (SELECT TOP 1 descripcion FROM dbo.BeneficiarioPostulacionAnterior WHERE idBeneficiario=l.idBeneficiario) applications
          FROM dbo.LeadCaso lc JOIN dbo.Lead l ON l.idLead=lc.idLead WHERE lc.idLeadCaso=@id`,
          { id },
        )
      ).recordset[0];
      assert.deepEqual(needs, {
        courses: 'Física',
        applications: 'Primera postulación (no postuló antes)',
      });
      messages = await outgoing(db, scenario);
      assert.match(messages.at(-1).text, /lo que mejor te va es Meta UNT/);
      assert.match(messages.at(-1).text, /Para reforzar física, revisemos sus características/);
      const buttons = JSON.parse(messages.at(-1).markup).inline_keyboard.flat();
      assert.deepEqual(
        buttons.map((button) => button.text),
        ['Quiero la propuesta', 'Probar Explora gratis', 'Ver qué incluye'],
      );
      assert.equal(
        (await query(db, 'SELECT COUNT(*) n FROM dbo.PreguntaPerfil WHERE idLeadCaso=@id', { id }))
          .recordset[0].n,
        5,
      );
      assert.equal(
        (
          await query(
            db,
            "SELECT COUNT(*) n FROM dbo.Mensaje WHERE idLeadCaso=@id AND idDireccion=1 AND textoMensaje LIKE N'Carrera:%'",
            { id },
          )
        ).recordset[0].n,
        1,
      );
    });
  } finally {
    await close();
  }
});

test('los botones de la recomendación ofrecen Explora y preparan la propuesta con su enlace', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: true });
      const id = scenario.lead.id;
      await send(db, scenario, text(scenario, `/start ${scenario.code}`));
      for (const data of [
        `pf:${id}:c:0`,
        `pf:${id}:a:1`,
        `pf:${id}:b:1`,
        `pf:${id}:d:6`,
        `pf:${id}:e:1`,
      ])
        await send(db, scenario, press(scenario, data));
      const recommendation = (await outgoing(db, scenario)).at(-1);
      const tariff = JSON.parse(recommendation.markup)
        .inline_keyboard.flat()
        .find((button) => button.text === 'Quiero la propuesta')
        .callback_data.split(':')[3];

      await send(db, scenario, press(scenario, `pf:${id}:t`));
      assert.match((await outgoing(db, scenario)).at(-1).text, /\/prueba\//);

      await send(db, scenario, press(scenario, `pf:${id}:p:${tariff}`));
      const proposal = (await outgoing(db, scenario)).at(-1);
      assert.match(proposal.text, /\/oferta\//);
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.PropuestaComercial WHERE idLeadCasoEntrega=@id',
            {
              id,
            },
          )
        ).recordset[0].n,
        1,
      );
    });
  } finally {
    await close();
  }
});

test('un clic inválido o ajeno se cierra sin detener la cola ni cambiar el perfil', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: true });
      const id = scenario.lead.id;
      await send(db, scenario, text(scenario, `/start ${scenario.code}`));
      await flush(db, scenario);
      const before = (await outgoing(db, scenario)).length;

      const invalid = await send(db, scenario, press(scenario, `pf:${id}:c:9`));
      assert.equal(
        scenario.client.calls.at(-2).data.text,
        'Uy, no pude anotar eso. ¿Lo intentamos de nuevo?',
      );
      const foreign = await send(db, scenario, press(scenario, `pf:${id + 999999}:c:0`));
      for (const updateId of [invalid, foreign])
        assert.ok(
          (
            await query(
              db,
              'SELECT processedAt FROM dbo.App_TelegramInbox WHERE updateId=@updateId',
              {
                updateId,
              },
            )
          ).recordset[0].processedAt,
        );
      assert.equal((await outgoing(db, scenario)).length, before);
      assert.equal(
        (
          await query(
            db,
            `SELECT pb.carreraDeseada career FROM dbo.LeadCaso lc JOIN dbo.Lead l ON l.idLead=lc.idLead
            JOIN dbo.PerfilBeneficiario pb ON pb.idBeneficiario=l.idBeneficiario WHERE lc.idLeadCaso=@id`,
            { id },
          )
        ).recordset[0].career,
        null,
      );
    });
  } finally {
    await close();
  }
});

test('las preguntas que el agente hace al leer un mensaje libre también llevan botones', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: true });
      const incoming = await recordIncoming(scenario.lead.id, {
        text: 'Hola',
        channel: 3,
        level: 1,
      });
      await actOnAnalysis(scenario.lead.id, incoming.id, 'Hola', {
        level: 1,
        retraction: false,
        action: 'ask',
        tariffId: null,
        fields: [],
        understood: true,
        needsGuardian: false,
        guardian: null,
      });
      const reply = (await outgoing(db, scenario)).at(-1);
      assert.match(reply.text, /qué carrera te gustaría estudiar en la UNT/);
      assert.ok(
        JSON.parse(reply.markup)
          .inline_keyboard.flat()
          .some((button) => button.callback_data === `pf:${scenario.lead.id}:c:0`),
      );
    });
  } finally {
    await close();
  }
});

test('"Otra respuesta" no se repite ni borra el teclado aunque se pulse muchas veces', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: true });
      const id = scenario.lead.id;
      await send(db, scenario, text(scenario, `/start ${scenario.code}`));
      await flush(db, scenario);
      const before = (await outgoing(db, scenario)).length;
      for (let press_ = 0; press_ < 4; press_ += 1)
        await send(db, scenario, press(scenario, `pf:${id}:c:x`));
      const messages = await outgoing(db, scenario);
      assert.equal(messages.length, before + 1);
      assert.match(messages.at(-1).text, /Escríbeme tu respuesta/);
      assert.equal(
        scenario.client.calls.filter((call) => call.method === 'editMessageReplyMarkup').length,
        0,
      );
      await send(db, scenario, press(scenario, `pf:${id}:c:0`));
      assert.equal(
        scenario.client.calls.filter((call) => call.method === 'editMessageReplyMarkup').length,
        1,
      );
    });
  } finally {
    await close();
  }
});

test('un fallo o lentitud de Telegram al avisar el clic no detiene ni invalida la actualización', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: true });
      await send(db, scenario, text(scenario, `/start ${scenario.code}`));
      await flush(db, scenario);
      const slow = [];
      scenario.client.call = async (method, data, options) => {
        slow.push({ method, options });
        if (['answerCallbackQuery', 'editMessageReplyMarkup'].includes(method))
          throw new Error('Telegram rechazó la solicitud (400).');
        return { message_id: 1 };
      };
      const updateId = await send(db, scenario, press(scenario, `pf:${scenario.lead.id}:c:0`));
      assert.ok(
        (
          await query(
            db,
            'SELECT processedAt FROM dbo.App_TelegramInbox WHERE updateId=@updateId',
            {
              updateId,
            },
          )
        ).recordset[0].processedAt,
      );
      const notices = slow.filter((call) => call.method === 'answerCallbackQuery');
      assert.equal(notices.length, 1);
      assert.deepEqual(notices[0].options, { timeout: 5000 });
    });
  } finally {
    await close();
  }
});

test('al volver a abrir el enlace no repregunta lo ya respondido y retoma donde se quedó', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: true });
      const id = scenario.lead.id;
      await send(db, scenario, text(scenario, `/start ${scenario.code}`));
      await send(db, scenario, press(scenario, `pf:${id}:c:0`));
      const asked = async (field) =>
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.PreguntaPerfil WHERE idLeadCaso=@id AND idCampoPerfil=@field',
            { id, field },
          )
        ).recordset[0].n;

      await saveLink(db, scenario.lead.contact, hashCode('segundo-enlace'), true);
      await send(db, scenario, text(scenario, '/start segundo-enlace'));
      let last = (await outgoing(db, scenario)).at(-1);
      assert.match(
        last.text,
        /^¡Qué bueno verte de nuevo, Estudiante! 😊 Sigamos donde nos quedamos\./,
      );
      assert.match(last.text, /¿Cuánto tiempo puedes dedicar a estudiar\?/);
      assert.doesNotMatch(last.text, /carrera/i);
      assert.equal(await asked(2), 1);

      await send(db, scenario, press(scenario, `pf:${id}:a:1`));
      await send(db, scenario, press(scenario, `pf:${id}:b:1`));
      await saveLink(db, scenario.lead.contact, hashCode('tercer-enlace'), true);
      await send(db, scenario, text(scenario, '/start tercer-enlace'));
      last = (await outgoing(db, scenario)).at(-1);
      assert.match(last.text, /Sigamos donde nos quedamos/);
      // La pregunta opcional de cursos ya se hizo una vez: no se repite y sigue la de postulaciones.
      assert.match(last.text, /¿Ya postulaste antes a la UNT\?/);
      assert.equal(await asked(3), 1);
      assert.equal(await asked(4), 1);
      // La carrera, ya respondida, no se vuelve a preguntar. La disponibilidad se retomó una vez
      // porque estaba pendiente cuando se reabrió el enlace.
      assert.equal(await asked(2), 1);
      assert.equal(await asked(6), 2);
      assert.equal(await asked(7), 1);
    });
  } finally {
    await close();
  }
});

test('getRequestedPlan no falla (PLAN es palabra reservada) y devuelve el plan pedido en el formulario', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: true });
      assert.equal(await getRequestedPlan(db, scenario.lead.contact), null);
      const inquiry = await publicRepository.saveInquiry(db, {
        name: 'Estudiante Prueba',
        email: `plan-${Date.now()}@example.test`,
        beneficiary: 'Estudiante Prueba',
        isStudent: true,
        plan: 'Meta UNT',
        consent: true,
      });
      await publicRepository.linkInquiry(
        db,
        inquiry,
        scenario.lead.contact,
        scenario.lead.id,
        'Vinculada',
      );
      const requested = await getRequestedPlan(db, scenario.lead.contact);
      assert.equal(requested.plan, 'Meta UNT');
    });
  } finally {
    await close();
  }
});

test('las preguntas sobre medios de pago se entienden y van al catálogo', async () => {
  const { validateAnalysis } = await import('../agent/ollama.mjs');
  for (const text of ['Qué medios de pago aceptan?', 'como puedo comprar un plan']) {
    const analysis = validateAnalysis(
      {
        level: 2,
        retraction: false,
        action: 'ask',
        tariffId: null,
        fields: [],
        understood: false,
        needsGuardian: false,
        guardian: null,
      },
      text,
      [],
    );
    assert.equal(analysis.understood, true);
    assert.equal(analysis.action, 'catalog');
  }
});

const incomingCount = async (db, scenario) =>
  (
    await query(
      db,
      'SELECT COUNT(*) n FROM dbo.Mensaje WHERE idContacto=@contact AND idDireccion=1',
      { contact: scenario.lead.contact },
    )
  ).recordset[0].n;

test('responder con un botón del teclado es un mensaje real, se registra una vez y avanza el perfil', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: true });
      await send(db, scenario, text(scenario, `/start ${scenario.code}`));
      await flush(db, scenario);
      const before = await incomingCount(db, scenario);
      await send(db, scenario, text(scenario, 'ingenieria de sistemas'));
      assert.equal((await incomingCount(db, scenario)) - before, 1);
      const answered = (
        await query(
          db,
          `SELECT m.textoMensaje message, pb.carreraDeseada career
           FROM dbo.Mensaje m
           JOIN dbo.LeadCaso lc ON lc.idLeadCaso=m.idLeadCaso
           JOIN dbo.Lead l ON l.idLead=lc.idLead
           JOIN dbo.PerfilBeneficiario pb ON pb.idBeneficiario=l.idBeneficiario
           WHERE m.idMensaje=(SELECT MAX(idMensaje) FROM dbo.Mensaje WHERE idContacto=@contact AND idDireccion=1)`,
          { contact: scenario.lead.contact },
        )
      ).recordset[0];
      assert.equal(answered.message, 'ingenieria de sistemas');
      assert.equal(answered.career, 'Ingeniería de Sistemas');
      const [sent] = (await flush(db, scenario)).slice(-1);
      assert.match(sent.data.text, /¿Cuánto tiempo puedes dedicar a estudiar\?/);
      assert.ok(
        sent.data.reply_markup.keyboard.flat().some((b) => b.text === 'Solo fines de semana'),
      );
      const repeated = await incomingCount(db, scenario);
      await send(db, scenario, text(scenario, 'Ingeniería de Sistemas'));
      assert.equal(
        (
          await query(
            db,
            'SELECT COUNT(*) n FROM dbo.CambioPerfil cp WHERE cp.idLeadCaso=@id AND cp.idCampoPerfil=2',
            { id: scenario.lead.id },
          )
        ).recordset[0].n,
        1,
      );
      assert.ok((await incomingCount(db, scenario)) >= repeated);
    });
  } finally {
    await close();
  }
});

test('"Otra respuesta" escrita con el teclado pide el texto una sola vez y quita el teclado', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: true });
      await send(db, scenario, text(scenario, `/start ${scenario.code}`));
      await flush(db, scenario);
      await send(db, scenario, text(scenario, 'Otra respuesta'));
      const prompts = async () =>
        (await outgoing(db, scenario)).filter((m) =>
          m.text.startsWith('¡Claro! Escríbeme tu respuesta'),
        );
      assert.equal((await prompts()).length, 1);
      assert.deepEqual(JSON.parse((await prompts())[0].markup), { remove_keyboard: true });
      const [sent] = (await flush(db, scenario)).slice(-1);
      assert.deepEqual(sent.data.reply_markup, { remove_keyboard: true });
    });
  } finally {
    await close();
  }
});

test('mensajes sociales: se responden con calidez y retoman la pregunta, sin contar como fallo', async () => {
  const { isSocialMessage } = await import('../agent/social.mjs');
  for (const value of ['te quiero', 'Te quiero mucho!!', 'jajaja', '😊', 'Ok!', 'GRACIAS POR TODO'])
    assert.equal(isSocialMessage(value), true, value);
  for (const value of ['quiero', 'hola cuanto cuesta', '?', 'te quiero comprar el plan', ''])
    assert.equal(isSocialMessage(value), false, value);
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: true });
      await send(db, scenario, text(scenario, `/start ${scenario.code}`));
      await flush(db, scenario);
      await send(db, scenario, text(scenario, 'te quiero'));
      const last = (await outgoing(db, scenario)).at(-1);
      assert.match(last.text, /^¡Qué amable! 😊 Sigo aquí para ayudarte a elegir tu plan\./);
      assert.match(last.text, /¿Qué carrera te gustaría estudiar en la UNT\?/);
      assert.ok(JSON.parse(last.markup).inline_keyboard.flat().length >= 4);
      assert.doesNotMatch(last.text, /No pude interpretar/);
      const failures = (
        await query(
          db,
          'SELECT consecutiveFailures n FROM dbo.App_AgentFailures WHERE idContacto=@contact',
          { contact: scenario.lead.contact },
        )
      ).recordset[0];
      assert.equal(failures?.n ?? 0, 0);
      assert.equal(
        (
          await query(db, 'SELECT COUNT(*) n FROM dbo.Derivacion WHERE idContacto=@contact', {
            contact: scenario.lead.contact,
          })
        ).recordset[0].n,
        0,
      );
    });
  } finally {
    await close();
  }
});

test('al derivar se avisa una sola vez y el aviso sale aunque la derivación ya esté abierta', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: true });
      await send(db, scenario, text(scenario, `/start ${scenario.code}`));
      await flush(db, scenario);
      await send(db, scenario, text(scenario, 'Quiero hablar con una persona'));
      await send(db, scenario, text(scenario, 'Sigo esperando a alguien por favor'));
      const notices = (await outgoing(db, scenario)).filter((row) =>
        row.text.startsWith('Voy a pasar tu consulta a un asesor'),
      );
      assert.equal(notices.length, 1);
      const before = scenario.client.calls.length;
      const sent = await flush(db, scenario);
      assert.equal(scenario.client.calls.length - before, 1);
      assert.match(sent.at(-1).data.text, /Voy a pasar tu consulta a un asesor/);
      assert.equal(sent.at(-1).data.reply_markup, undefined);
      await send(db, scenario, text(scenario, 'cuanto cuesta meta unt'));
      assert.equal((await flush(db, scenario)).length, sent.length);
    });
  } finally {
    await close();
  }
});

test('foto sin texto cuenta como respuesta, pide el texto y no cuenta como fallo; con leyenda se analiza', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: true });
      await send(db, scenario, text(scenario, `/start ${scenario.code}`));
      await flush(db, scenario);
      const photo = (caption) => (id) => ({
        message: {
          message_id: id,
          from: { id: 123, is_bot: false },
          chat: { id: scenario.chat, type: 'private' },
          photo: [{ file_id: 'f', width: 10, height: 10 }],
          ...(caption ? { caption } : {}),
        },
      });
      await send(db, scenario, photo());
      const incoming = (
        await query(
          db,
          'SELECT TOP 1 textoMensaje text FROM dbo.Mensaje WHERE idContacto=@contact AND idDireccion=1 ORDER BY idMensaje DESC',
          { contact: scenario.lead.contact },
        )
      ).recordset[0];
      assert.equal(incoming.text, '[Adjunto sin texto]');
      assert.match(
        (await outgoing(db, scenario)).at(-1).text,
        /solo puedo leer mensajes de texto.*no con una captura/,
      );
      const failures = (
        await query(
          db,
          'SELECT consecutiveFailures n FROM dbo.App_AgentFailures WHERE idContacto=@contact',
          {
            contact: scenario.lead.contact,
          },
        )
      ).recordset[0];
      assert.equal(failures?.n ?? 0, 0);
      await send(db, scenario, photo('Ya pagué, aquí está el comprobante'));
      const handoff = (
        await query(
          db,
          'SELECT idMotivoDerivacion reason FROM dbo.Derivacion WHERE idContacto=@contact',
          {
            contact: scenario.lead.contact,
          },
        )
      ).recordset[0];
      assert.equal(handoff.reason, 5);
    });
  } finally {
    await close();
  }
});

test('el agente habla según el rol: a la madre le pregunta por su hijo y lo nombra', async () => {
  try {
    await rollbackTest(async (db) => {
      const suffix = Date.now() + Math.floor(Math.random() * 1000);
      const lead = await createLead({
        name: 'Rosa Madre',
        email: `madre-${suffix}@example.test`,
        phone: '+51912345678',
        role: 3,
        beneficiaryName: `Juan Hijo ${suffix}`,
        channel: 1,
        communicationChannel: 2,
        consent: true,
      });
      const code = `madre-${suffix}`;
      await saveLink(db, lead.contact, hashCode(code), true);
      const scenario = { lead, chat: String(suffix), client: fakeClient(), sequence: suffix };
      await send(db, scenario, text(scenario, `/start ${code}`));
      let messages = await outgoing(db, scenario);
      const first = messages.find((row) => /Hola, Rosa/.test(row.text));
      assert.match(first.text, /el plan que mejor se adapte a Juan/);
      assert.match(first.text, /¿Qué carrera le gustaría estudiar a Juan\?/);
      const id = lead.id;
      for (const data of [`pf:${id}:c:0`, `pf:${id}:a:1`])
        await send(db, scenario, press(scenario, data));
      messages = await outgoing(db, scenario);
      assert.match(
        messages.at(-1).text,
        /¿Cuánto podrían invertir al mes en la preparación de Juan\?/,
      );
      await send(db, scenario, press(scenario, `pf:${id}:b:1`));
      await send(db, scenario, press(scenario, `pf:${id}:d:2`));
      messages = await outgoing(db, scenario);
      assert.match(messages.at(-1).text, /¿Juan ya postuló antes a la UNT\?/);
      assert.deepEqual(
        JSON.parse(messages.at(-1).markup)
          .inline_keyboard.flat()
          .map((button) => button.text)
          .slice(0, 3),
        ['Es su primera vez', 'Ya postuló una vez', 'Postuló dos veces o más'],
      );
      await send(db, scenario, press(scenario, `pf:${id}:e:1`));
      messages = await outgoing(db, scenario);
      assert.match(messages.at(-1).text, /lo que mejor le va a Juan es Meta UNT/);
      const stored = (
        await query(
          db,
          'SELECT TOP 1 descripcion FROM dbo.BeneficiarioPostulacionAnterior b JOIN dbo.Lead l ON l.idBeneficiario=b.idBeneficiario WHERE l.idContacto=@c',
          { c: lead.contact },
        )
      ).recordset[0].descripcion;
      assert.equal(stored, 'Postuló una vez');
    });
  } finally {
    await close();
  }
});

test('Telegram ya vinculado a otra persona: el aviso lo explica y el enlace sigue sirviendo a su dueño', async () => {
  try {
    await rollbackTest(async (db) => {
      const scenario = await setup(db, { consent: true });
      await send(db, scenario, text(scenario, `/start ${scenario.code}`));
      const other = await createLead({
        name: 'Hermano Prueba',
        email: `hermano-${Date.now()}@example.test`,
        phone: '+51912345678',
        role: 1,
        channel: 1,
        communicationChannel: 2,
        consent: true,
      });
      await saveLink(db, other.contact, hashCode('enlace-hermano'), true);
      await send(db, scenario, text(scenario, '/start enlace-hermano'));
      const reply = scenario.client.calls.filter((call) => call.method === 'sendMessage').at(-1);
      assert.match(reply.data.text, /ya está vinculada a otra persona/);
      const unused = (
        await query(db, 'SELECT usedAt FROM dbo.App_TelegramLink WHERE codeHash=@h', {
          h: hashCode('enlace-hermano'),
        })
      ).recordset[0];
      assert.equal(unused.usedAt, null, 'El enlace no se consume');
    });
  } finally {
    await close();
  }
});
