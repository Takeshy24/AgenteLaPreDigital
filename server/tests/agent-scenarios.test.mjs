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

async function scenario(db) {
  const email = `${randomUUID()}@example.test`;
  const lead = await createLead({
    name: `Escenario ${randomUUID()}`,
    email,
    phone: '+51912345678',
    role: 1,
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
      assert.match(
        reply.text,
        /^Ruta UNT no tiene modalidad semestral; solo se contrata mensual\./,
      );
      const count = await latest(
        'SELECT COUNT(*) n FROM dbo.PropuestaComercial WHERE idLeadCasoEntrega=@id',
      );
      assert.equal(count.n, 0);
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
