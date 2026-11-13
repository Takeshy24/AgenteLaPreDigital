// Escenarios del agente frente a las reglas del informe (secciones 2.2, 2.3, 2.5 y F5): cada prueba
// arma el análisis con las reglas deterministas (sin Ollama) y verifica las filas en la base.
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { close, query, rollbackTest } from '../db.mjs';
import { createLead } from '../leads/service.mjs';
import { recordIncoming } from '../messages/service.mjs';
import { actOnAnalysis } from '../agent/service.mjs';
import { applyIntentRules } from '../agent/intents.mjs';
import { validateAnalysis } from '../agent/ollama.mjs';
import { getRecentHistory } from '../agent/repository.mjs';
import { getWorkspace } from '../workspace/repository.mjs';
import { dispatchMessage } from '../integrations/dispatch.mjs';

process.env.SMTP_PASSWORD = '';

const base = () => ({
  level: 1,
  retraction: false,
  action: 'ask',
  tariffId: null,
  fields: [],
  understood: true,
  needsGuardian: false,
  guardian: null,
});

async function scenario(db, { role = 1, beneficiaryName } = {}) {
  const email = `${randomUUID()}@example.test`;
  const lead = await createLead({
    name: `Escenario ${randomUUID()}`,
    email,
    phone: '+51912345678',
    role,
    beneficiaryName,
    channel: 1,
    communicationChannel: 2,
    consent: true,
  });
  const contact = (
    await query(db, 'SELECT idContacto FROM dbo.Contacto WHERE correo=@email', { email })
  ).recordset[0].idContacto;
  await query(db, 'INSERT dbo.App_TelegramChat(idContacto,chatId) VALUES(@contact,@chat)', {
    contact,
    chat: `e-${randomUUID().slice(0, 18)}`,
  });
  const { tariffs } = await getWorkspace();
  const say = async (text, analysis = applyIntentRules(base(), text, tariffs)) => {
    const message = await recordIncoming(lead.id, {
      text,
      channel: 3,
      level: analysis.level,
      retraction: analysis.retraction,
    });
    await actOnAnalysis(lead.id, message.id, text, analysis);
    const reply = (
      await query(
        db,
        'SELECT TOP 1 idMensaje id,textoMensaje text FROM dbo.Mensaje WHERE idLeadCaso=@id AND idDireccion=2 ORDER BY idMensaje DESC',
        { id: lead.id },
      )
    ).recordset[0];
    return { messageId: message.id, reply, analysis };
  };
  const deliverLast = async () => {
    const pending = (
      await query(
        db,
        'SELECT idMensaje id FROM dbo.Mensaje WHERE idLeadCaso=@id AND idDireccion=2 AND idEstadoEntrega=1',
        { id: lead.id },
      )
    ).recordset;
    for (const row of pending)
      await dispatchMessage(row.id, { call: async () => ({ message_id: 1 }) });
  };
  const latest = async (sql) => (await query(db, sql, { id: lead.id })).recordset[0];
  return { lead, contact, say, deliverLast, latest };
}

test('rechazo por chat de una propuesta entregada: Rechazada con su mensaje y nivel Consulta', async () => {
  try {
    await rollbackTest(async (db) => {
      const { say, deliverLast, latest } = await scenario(db);
      await say('Quiero contratar Ruta UNT mensual');
      await deliverLast();
      const { messageId, reply } = await say('Por ahora no me interesa ese plan');
      const proposal = await latest(
        'SELECT TOP 1 idResultado result,idMensajeRespuesta message FROM dbo.PropuestaComercial WHERE idLeadCasoEntrega=@id ORDER BY idPropuesta DESC',
      );
      assert.deepEqual([proposal.result, proposal.message], [2, messageId]);
      assert.match(reply.text, /dejo esa propuesta como no aceptada/);
      const evaluation = await latest(
        'SELECT TOP 1 idNivelInteres level,idPrioridadAsignada priority FROM dbo.EvaluacionPrioridad WHERE idLeadCaso=@id ORDER BY idEvaluacion DESC',
      );
      assert.deepEqual([evaluation.level, evaluation.priority], [2, 3]);
    });
  } finally {
    await close();
  }
});

test('aceptación por chat: envía el enlace de la oferta y no registra la aceptación sin condiciones', async () => {
  try {
    await rollbackTest(async (db) => {
      const { say, deliverLast, latest } = await scenario(db);
      await say('Quiero contratar Ruta UNT mensual');
      await deliverLast();
      const { reply, analysis } = await say('Acepto la propuesta');
      assert.equal(analysis.level, 3);
      assert.match(reply.text, /\/oferta\/[A-Za-z0-9_-]+/);
      assert.match(reply.text, /La aceptación no confirma el pago/);
      const proposal = await latest(
        'SELECT TOP 1 idResultado result FROM dbo.PropuestaComercial WHERE idLeadCasoEntrega=@id',
      );
      assert.equal(proposal.result, null);
    });
  } finally {
    await close();
  }
});

test('modalidad inexistente: Ruta UNT semestral no prepara propuesta y lo explica', async () => {
  try {
    await rollbackTest(async (db) => {
      const { say, latest } = await scenario(db);
      const { reply, analysis } = await say('Quiero contratar Ruta UNT semestral');
      assert.deepEqual([analysis.action, analysis.tariffId], ['proposal', null]);
      assert.match(reply.text, /Esa combinación no está disponible.*plan y modalidad/);
      const count = await latest(
        'SELECT COUNT(*) n FROM dbo.PropuestaComercial WHERE idLeadCasoEntrega=@id',
      );
      assert.equal(count.n, 0);
    });
  } finally {
    await close();
  }
});

test('cambiar Plus por Ruta en el chat prepara la tarifa y el enlace de Ruta, sin duplicarla al corregir', async () => {
  try {
    await rollbackTest(async (db) => {
      const { lead, say, deliverLast, latest } = await scenario(db);
      const { tariffs } = await getWorkspace();
      const ruta = tariffs.find((item) => item.plan === 'Ruta UNT' && item.modalidad === 'Mensual');
      const plus = tariffs.find(
        (item) => item.plan === 'Meta UNT Plus' && item.modalidad === 'Mensual',
      );
      await say('Quiero contratar Meta UNT Plus mensual');
      await deliverLast();
      for (const text of [
        'quiero ruta unt mensual porfavoooor :)',
        'pero yo quiero ruta unt, no meta unt plus por favor',
      ]) {
        const analysis = validateAnalysis(
          { ...base(), action: 'proposal', tariffId: plus.idPlanTarifa },
          text,
          tariffs,
          {
            requestedPlan: { plan: plus.plan, period: plus.modalidad },
            history: await getRecentHistory(db, lead.id),
          },
        );
        assert.equal(analysis.tariffId, ruta.idPlanTarifa);
        await say(text, analysis);
        const saved = await latest(
          `SELECT TOP 1 p.idPlanTarifa tariff, p.precioAutorizado price, m.textoMensaje text,
            (SELECT COUNT(*) FROM dbo.App_PublicOffer o WHERE o.idPropuesta=p.idPropuesta) offers
          FROM dbo.PropuestaComercial p INNER JOIN dbo.Mensaje m ON m.idMensaje=p.idMensajeEntrega
          WHERE p.idLeadCasoEntrega=@id ORDER BY p.idPropuesta DESC`,
        );
        assert.equal(saved.tariff, ruta.idPlanTarifa);
        assert.equal(Number(saved.price), Number(ruta.precio));
        assert.match(saved.text, /^Propuesta Ruta UNT\./);
        assert.doesNotMatch(saved.text, /Meta UNT Plus/);
        assert.match(saved.text, /\/oferta\/[A-Za-z0-9_-]+/);
        assert.ok(saved.offers > 0);
      }
      assert.equal(
        (await latest('SELECT COUNT(*) n FROM dbo.PropuestaComercial WHERE idLeadCasoEntrega=@id'))
          .n,
        2,
      );
    });
  } finally {
    await close();
  }
});

test('objeciones: se registran por tipo y se atienden sin derivar', async () => {
  try {
    await rollbackTest(async (db) => {
      const { say, latest, contact } = await scenario(db);
      const price = await say('Me parece caro, ¿hay algo más económico?');
      assert.match(
        price.reply.text,
        /Explora UNT es gratis por 14 días.*Ruta UNT cuesta S\/ 39\.90 al mes/,
      );
      const time = await say('No tengo tiempo, trabajo todo el día');
      assert.match(time.reply.text, /cuánto tiempo podrías dedicar/);
      const trust = await say('¿Es confiable? Ya estoy en una academia');
      assert.match(trust.reply.text, /Explora UNT puedes probarla gratis 14 días/);
      const rows = (
        await query(
          db,
          'SELECT idTipoObjecion type FROM dbo.ObjecionComercial o JOIN dbo.LeadCaso l ON l.idLeadCaso=o.idLeadCaso JOIN dbo.Lead d ON d.idLead=l.idLead WHERE d.idContacto=@contact ORDER BY idObjecion',
          { contact },
        )
      ).recordset.map((row) => row.type);
      assert.deepEqual(rows, [1, 3, 2]);
      const handoffs = await latest(
        'SELECT COUNT(*) n FROM dbo.Derivacion d JOIN dbo.LeadCaso l ON l.idLeadCaso=@id JOIN dbo.Lead x ON x.idLead=l.idLead WHERE d.idContacto=x.idContacto',
      );
      assert.equal(handoffs.n, 0);
    });
  } finally {
    await close();
  }
});

test('descuentos: la pregunta se responde con la base; el pedido expreso deriva (motivo 6)', async () => {
  try {
    await rollbackTest(async (db) => {
      const { say, contact } = await scenario(db);
      const question = await say('¿Tienen becas o descuentos?');
      assert.match(question.reply.text, /los evalúa el personal comercial/);
      const count = async () =>
        (
          await query(
            db,
            'SELECT COUNT(*) n, MAX(idMotivoDerivacion) reason FROM dbo.Derivacion WHERE idContacto=@contact',
            { contact },
          )
        ).recordset[0];
      assert.equal((await count()).n, 0);
      await say('Quiero solicitar un descuento, por favor');
      assert.deepEqual(Object.values(await count()), [1, 6]);
    });
  } finally {
    await close();
  }
});

test('necesidades académicas por texto libre: cursos, postulación y puntaje; preguntas opcionales una vez', async () => {
  try {
    await rollbackTest(async (db) => {
      const { say, lead } = await scenario(db);
      const extracted = applyIntentRules(
        base(),
        'Me cuesta física y química, ya postulé dos veces y saqué 250 puntos',
        [],
      );
      assert.deepEqual(
        Object.fromEntries(extracted.fields.map((item) => [item.field, item.value])),
        { courses: 'Física, Química', applications: 'Postuló dos veces', score: '250' },
      );
      const question = await say('Quiero estudiar Derecho, 3 horas al día y tengo 80 soles al mes');
      assert.match(question.reply.text, /¿qué cursos se te hacen más difíciles\?/);
      const next = await say('Me cuesta física y química');
      assert.match(next.reply.text, /^¡Anotado! ¿Ya postulaste antes a la UNT\?/);
      const last = await say('No, es mi primera vez');
      assert.match(last.reply.text, /Para reforzar física, química/);
      const needs = (
        await query(
          db,
          `SELECT (SELECT STRING_AGG(curso, ',') WITHIN GROUP (ORDER BY curso) FROM dbo.BeneficiarioCursoDificil WHERE idBeneficiario=l.idBeneficiario) courses,
          (SELECT TOP 1 descripcion FROM dbo.BeneficiarioPostulacionAnterior WHERE idBeneficiario=l.idBeneficiario) applications,
          (SELECT COUNT(*) FROM dbo.CambioPerfil WHERE idLeadCaso=lc.idLeadCaso AND idCampoPerfil IN (3,4)) changes
          FROM dbo.LeadCaso lc JOIN dbo.Lead l ON l.idLead=lc.idLead WHERE lc.idLeadCaso=@id`,
          { id: lead.id },
        )
      ).recordset[0];
      assert.deepEqual(needs, {
        courses: 'Física,Química',
        applications: 'Primera postulación (no postuló antes)',
        changes: 2,
      });
      const again = await say('Hola de nuevo');
      assert.doesNotMatch(again.reply.text, /cursos|postulaste/);
    });
  } finally {
    await close();
  }
});

test('responsable económico por partes: pide lo que falta y envía el enlace con WhatsApp listo', async () => {
  try {
    await rollbackTest(async (db) => {
      const { say, lead } = await scenario(db);
      const first = await say('Mi papá es el que decide');
      assert.match(
        first.reply.text,
        /incluir a tu papá.*su nombre completo y su número de celular/,
      );
      const second = await say('Se llama Carlos Ruiz');
      assert.match(second.reply.text, /solo me falta su número de celular/);
      const third = await say('Su número es 912 345 678');
      assert.match(third.reply.text, /Preparé la invitación para Carlos Ruiz/);
      assert.match(third.reply.text, /https:\/\/wa\.me\/51912345678\?text=Hola%20Carlos/);
      assert.match(third.reply.text, /\/invitacion\/[0-9a-f-]{36}/);
      const invitation = (
        await query(
          db,
          `SELECT i.nombreInvitado nombre, i.telefonoInvitado tel, i.idRolInvitado rol
          FROM dbo.InvitacionVinculacion i JOIN dbo.NecesidadVinculacion n ON n.idNecesidad=i.idNecesidad
          JOIN dbo.LeadCaso lc ON lc.idCaso=n.idCaso WHERE lc.idLeadCaso=@id`,
          { id: lead.id },
        )
      ).recordset;
      assert.deepEqual(invitation, [{ nombre: 'Carlos Ruiz', tel: '+51912345678', rol: 2 }]);
    });
  } finally {
    await close();
  }
});

test('el padre pide invitar a su esposa: solicita sus datos antes de continuar el perfil de David', async () => {
  try {
    await rollbackTest(async (db) => {
      const beneficiary = `David ${randomUUID()}`;
      const { lead, say, latest } = await scenario(db, { role: 2, beneficiaryName: beneficiary });
      const { tariffs } = await getWorkspace();
      await say('La carrera de David es Ingeniería de Sistemas');
      const text = 'Hola quiero enviarle el link de invitación a mi esposa';
      const first = await say(
        text,
        validateAnalysis(base(), text, tariffs, { history: await getRecentHistory(db, lead.id) }),
      );
      assert.match(first.reply.text, /esposa/);
      assert.match(first.reply.text, /su nombre completo y su número de celular/);
      assert.doesNotMatch(first.reply.text, /cuánto tiempo|horas|presupuesto/);
      assert.equal(
        (
          await latest(
            'SELECT COUNT(*) n FROM dbo.NecesidadVinculacion WHERE idLeadCasoDeclara=@id',
          )
        ).n,
        1,
      );
      assert.equal(
        (
          await latest(
            `SELECT COUNT(*) n FROM dbo.InvitacionVinculacion i
            INNER JOIN dbo.NecesidadVinculacion n ON n.idNecesidad=i.idNecesidad WHERE n.idLeadCasoDeclara=@id`,
          )
        ).n,
        0,
      );
      const second = await say('Se llama Patricia Pérez');
      assert.match(second.reply.text, /solo me falta su número de celular/);
      const third = await say('Su celular es 912345678');
      assert.match(third.reply.text, /Preparé la invitación para Patricia Pérez/);
      assert.match(third.reply.text, /https:\/\/wa\.me\/51912345678\?text=/);
      assert.match(third.reply.text, /\/invitacion\/[0-9a-f-]{36}/);
      const share = third.reply.text.match(/https:\/\/wa\.me\/\d+\?text=(\S+)/)[1];
      assert.ok(decodeURIComponent(share).includes(`la preparación de ${beneficiary}`));
      const invitation = await latest(
        `SELECT i.nombreInvitado name, i.telefonoInvitado phone, i.idRolInvitado role
        FROM dbo.InvitacionVinculacion i INNER JOIN dbo.NecesidadVinculacion n ON n.idNecesidad=i.idNecesidad
        WHERE n.idLeadCasoDeclara=@id`,
      );
      assert.deepEqual(invitation, { name: 'Patricia Pérez', phone: '+51912345678', role: 4 });
    });
  } finally {
    await close();
  }
});

test('invitación directa al responsable ya registrado: Telegram, WhatsApp en 24 h, correo y respaldo', async () => {
  const { deliverDirectInvitation, findDirectTarget } = await import('../links/direct.mjs');
  const { acceptPublicInvitation, viewInvitation } = await import('../public/invitations.mjs');
  const { saveConsent } = await import('../consents/service.mjs');
  process.env.TELEGRAM_ENABLED = 'true';
  process.env.TELEGRAM_BOT_TOKEN ||= 'token-de-prueba';
  process.env.WHATSAPP_ENABLED = 'true';
  const mother = async (db, channel) => {
    const email = `rosa-${randomUUID()}@example.test`;
    const lead = await createLead({
      name: `Rosa Díaz ${randomUUID().slice(0, 6)}`,
      email,
      phone: '+51987654321',
      role: 3,
      beneficiaryName: `Juan ${randomUUID().slice(0, 6)}`,
      channel: 1,
      communicationChannel: channel,
      consent: true,
    });
    const contact = (
      await query(db, 'SELECT idContacto FROM dbo.Contacto WHERE correo=@email', { email })
    ).recordset[0].idContacto;
    return { lead, contact };
  };
  const lastTo = async (db, contact) =>
    (
      await query(
        db,
        'SELECT TOP 1 idMensaje id, idCanal canal, idEstadoEntrega estado, idLeadCaso, textoMensaje text FROM dbo.Mensaje WHERE idContacto=@contact AND idDireccion=2 ORDER BY idMensaje DESC',
        { contact },
      )
    ).recordset[0];
  try {
    // Telegram: la madre ya inició el bot y autorizó Telegram.
    await rollbackTest(async (db) => {
      const rosa = await mother(db, 2);
      await query(
        db,
        "UPDATE dbo.Contacto SET inicioBotTelegram=1, usuarioTelegram=N'rosa' WHERE idContacto=@c; INSERT dbo.App_TelegramChat(idContacto,chatId) VALUES(@c,@chat)",
        { c: rosa.contact, chat: `r-${randomUUID().slice(0, 12)}` },
      );
      await query(
        db,
        'UPDATE dbo.AutorizacionContacto SET fechaOtorgamiento=DATEADD(DAY,-2,fechaOtorgamiento) WHERE idContacto=@c',
        { c: rosa.contact },
      );
      await saveConsent(rosa.lead.id, { channel: 3, granted: true, version: 'test' });
      await query(db, 'DELETE dbo.AutorizacionContacto WHERE idContacto=@c AND idCanal=2', {
        c: rosa.contact,
      });
      const { say, lead } = await scenario(db);
      const reply = await say('Mi mamá se llama Rosa Díaz, su número es 987654321');
      assert.match(reply.reply.text, /Preparé el envío de la invitación directamente por Telegram/);
      assert.match(reply.reply.text, /pendiente de confirmación/);
      assert.match(reply.reply.text, /\/invitacion\//);
      const sent = await lastTo(db, rosa.contact);
      assert.deepEqual([sent.canal, sent.estado, sent.idLeadCaso], [3, 1, null]);
      assert.match(sent.text, /Escenario .* indicó que eres su mamá.*\/invitacion\//s);
      const calls = [];
      await dispatchMessage(sent.id, {
        call: async (method, data) => {
          calls.push({ method, data });
          return { message_id: 77 };
        },
      });
      assert.equal(calls[0].method, 'sendMessage');
      assert.match(calls[0].data.text, /\/invitacion\//);
      assert.equal((await lastTo(db, rosa.contact)).estado, 2, 'Telegram confirmó la entrega');
      const code = sent.text.match(/\/invitacion\/([0-9a-f-]{36})/)[1];
      assert.equal((await viewInvitation(code)).known, true);
      await acceptPublicInvitation(code, {
        name: 'Rosa',
        channels: [3],
        contactConsent: true,
        linkConsent: true,
      });
      const linked = (
        await query(
          db,
          'SELECT COUNT(*) n FROM dbo.LeadCaso lc JOIN dbo.Lead l ON l.idLead=lc.idLead JOIN dbo.LeadCaso est ON est.idCaso=lc.idCaso WHERE est.idLeadCaso=@id AND l.idContacto=@c',
          { id: lead.id, c: rosa.contact },
        )
      ).recordset[0].n;
      assert.equal(linked, 1, 'La madre registrada se une al caso sin crear otro contacto');
    });
    // WhatsApp: autorizó WhatsApp y escribió en las últimas 24 horas.
    await rollbackTest(async (db) => {
      const rosa = await mother(db, 1);
      await query(
        db,
        "INSERT dbo.Mensaje(idContacto,idLead,idLeadCaso,idDireccion,idCanal,textoMensaje) VALUES(@c,(SELECT idLead FROM dbo.LeadCaso WHERE idLeadCaso=@id),@id,1,1,N'Hola')",
        { c: rosa.contact, id: rosa.lead.id },
      );
      const { say } = await scenario(db);
      const reply = await say('Mi mamá se llama Rosa Díaz, su número es 987654321');
      assert.match(reply.reply.text, /directamente por WhatsApp/);
      assert.equal((await lastTo(db, rosa.contact)).canal, 1);
    });
    // WhatsApp fuera de las 24 horas y sin otro canal: se usa el enlace para reenviar.
    await rollbackTest(async (db) => {
      await mother(db, 1);
      const { say } = await scenario(db);
      const reply = await say('Mi mamá se llama Rosa Díaz, su número es 987654321');
      assert.match(reply.reply.text, /wa\.me\/51987654321/);
      assert.doesNotMatch(reply.reply.text, /directamente/);
    });
    // Correo: se envía y queda entregado.
    await rollbackTest(async (db) => {
      const rosa = await mother(db, 2);
      const target = await findDirectTarget(db, '+51987654321', -1);
      const student = await scenario(db);
      const asked = await recordIncoming(student.lead.id, {
        text: 'Mi mamá paga',
        channel: 3,
        level: 1,
      });
      const sent = [];
      const result = await deliverDirectInvitation(
        db,
        {
          target,
          text: 'Hola Rosa, revisa la invitación: https://x/invitacion/abc',
          replyTo: asked.id,
          email: { subject: 'Invitación', text: 'Hola', html: '<p>Hola</p>' },
        },
        { mailer: async (mail) => sent.push(mail) },
      );
      assert.equal(result.channel, 2);
      assert.equal(result.queued, false);
      assert.equal(sent[0].subject, 'Invitación');
      const row = await lastTo(db, rosa.contact);
      assert.deepEqual([row.canal, row.estado], [2, 2]);
    });
  } finally {
    await close();
  }
});
