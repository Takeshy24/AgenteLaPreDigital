// Siembra escenarios de prueba con fechas pasadas para probar ahora las reglas que dependen del
// tiempo (agenda, contadores, reevaluación, derivación de 24 horas, vencimientos, inactividad y
// reapertura). Solo inserta registros nuevos marcados como «Escenario E…» con correos
// escenario.e…@example.test; no modifica datos existentes. Uso:
//   npm run seed:scenarios -- --yes            siembra en la base del .env (DB_SERVER / DB_DATABASE)
//   npm run seed:scenarios -- --yes --apply    además ejecuta la revisión de vencimientos
import { createInterface } from 'node:readline/promises';
import { pool, query, transaction, close } from '../server/db.mjs';
import { reviewFollowup } from '../server/followup/service.mjs';
import { createOfferLink } from '../server/public/service.mjs';
import { getOperator, insert } from '../server/shared/repository.mjs';
import { ensureProfiles } from '../server/leads/repository.mjs';
import { insertContract, savePayment, saveValidation } from '../server/contracts/repository.mjs';

const apply = process.argv.includes('--apply');
const database = process.env.DB_DATABASE || 'LaPreDigital_OLTP';
const HOUR = 3600000;
const lima = (daysAgo, plusHours = 0) =>
  new Date(Date.now() - 5 * HOUR - daysAgo * 24 * HOUR + plusHours * HOUR)
    .toISOString()
    .slice(0, 19);
const AGENDA = [0, 1, 2, 5, 10, 17, 27];

if (!process.argv.includes('--yes')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `Se sembrarán 13 escenarios de prueba en ${process.env.DB_SERVER || 'localhost'} / ${database}. ¿Continuar? (s/N) `,
  );
  rl.close();
  if (!/^s/i.test(answer.trim())) process.exit(0);
}

const base = await pool();
let db = base;
const run = (text, params) => query(db, text, params);
const one = async (text, params) => (await run(text, params)).recordset[0];

if (
  (await one("SELECT COUNT(*) n FROM dbo.Contacto WHERE correo LIKE N'escenario.e%@example.test'"))
    .n
) {
  console.error(
    'Los escenarios ya existen. Limpia la base (npm run db:clean -- --local) y vuelve a ejecutar.',
  );
  await close();
  process.exit(1);
}

// Crea contacto, beneficiario, LEAD, caso y participación con las fechas del pasado indicadas.
async function lead(code, label, { daysAgo, role = 1, channel = 2, attempts = true }) {
  const at = lima(daysAgo);
  const contact = await insert(
    db,
    `INSERT dbo.Contacto (nombreCompleto, correo, telefono, fechaRegistro)
     VALUES (@name, @email, @phone, @at)`,
    {
      name: `Escenario ${code} ${label}`,
      email: `escenario.${code.toLowerCase()}@example.test`,
      phone: `+51900000${String(code.replace(/[^0-9]/g, '')).padStart(3, '0')}`,
      at,
    },
  );
  const beneficiaryName =
    role === 1 ? `Escenario ${code} ${label}` : `Estudiante Escenario ${code}`;
  const beneficiary = await insert(
    db,
    `INSERT dbo.Beneficiario (nombreCompleto, nombreNormalizado, idContactoBeneficiario)
     VALUES (@name, UPPER(@name), @student)`,
    { name: beneficiaryName, student: role === 1 ? contact : null },
  );
  await ensureProfiles(db, { contact, beneficiary });
  const leadId = await insert(
    db,
    `INSERT dbo.Lead (idContacto, idBeneficiario, idRolContacto, idCanalCaptacion, fechaCaptacion)
     VALUES (@contact, @beneficiary, @role, 1, @at)`,
    { contact, beneficiary, role, at },
  );
  const caseId = await insert(
    db,
    'INSERT dbo.Caso (idBeneficiario, fechaApertura) VALUES (@beneficiary, @at)',
    { beneficiary, at },
  );
  await run('INSERT dbo.EventoCaso (idCaso, idTipoEvento, fechaEvento) VALUES (@caseId, 2, @at)', {
    caseId,
    at,
  });
  const authorization = await insert(
    db,
    `INSERT dbo.AutorizacionContacto (idContacto, idCanal, idEstadoAutorizacion, fechaOtorgamiento, idOrigenAutorizacion, versionTexto)
     VALUES (@contact, @channel, 1, @at, 1, N'escenario-v1')`,
    { contact, channel, at },
  );
  const participation = await insert(
    db,
    `INSERT dbo.LeadCaso (idLead, idCaso, idRolContacto, fechaIncorporacion, fechaInicioElegibilidad)
     VALUES (@leadId, @caseId, @role, @at, @at)`,
    { leadId, caseId, role, at },
  );
  if (attempts)
    for (const [index, day] of AGENDA.entries())
      await run(
        'INSERT dbo.IntentoContacto (idLeadCaso, numeroIntento, fechaProgramada) VALUES (@participation, @n, DATEADD(DAY, @day, @at))',
        { participation, n: index + 1, day, at },
      );
  return {
    code,
    contact,
    beneficiary,
    leadId,
    caseId,
    authorization,
    participation,
    channel,
    daysAgo,
    at,
  };
}

async function message(
  p,
  { direction, at, text, channel = p.channel, origin = 1, replied = null },
) {
  return insert(
    db,
    `INSERT dbo.Mensaje (idContacto, idLead, idLeadCaso, idDireccion, idCanal, fechaHora, idOrigenMensaje,
       idAutorizacionAlEnvio, idMensajeRespondido, textoMensaje, idEstadoEntrega, fechaEntrega)
     VALUES (@contact, @lead, @participation, @direction, @channel, @at, @origin, @auth, @replied, @text, @state, @delivered)`,
    {
      contact: p.contact,
      lead: p.leadId,
      participation: p.participation,
      direction,
      channel,
      at,
      origin: direction === 2 ? origin : null,
      auth: direction === 2 && origin === 1 ? p.authorization : null,
      replied: direction === 2 ? replied : null,
      text,
      state: direction === 2 ? 2 : null,
      delivered: direction === 2 ? at : null,
    },
  );
}

// Entrega los intentos indicados (1 a 7) en su fecha programada, sin respuesta.
async function deliverAttempts(p, numbers) {
  for (const n of numbers) {
    const sent = await message(p, {
      direction: 2,
      at: lima(p.daysAgo - AGENDA[n - 1], 1),
      text: 'Hola. ¿Qué información necesitas para continuar tu preparación para la UNT?',
    });
    await run(
      'UPDATE dbo.IntentoContacto SET idMensajeEnvio = @sent WHERE idLeadCaso = @participation AND numeroIntento = @n',
      {
        sent,
        participation: p.participation,
        n,
      },
    );
  }
}
const omitAttempts = (p) =>
  run('UPDATE dbo.IntentoContacto SET omitido = 1 WHERE idLeadCaso = @participation', p);

async function evaluation(p, { at, priority, level, trigger = 1, source = 2, rule }) {
  await run(
    `INSERT dbo.EvaluacionPrioridad (idLeadCaso, fechaEvaluacion, idPrioridadAnterior, idPrioridadAsignada, idNivelInteres,
       idReglaAplicada, idDisparador, idFuenteNivel, intentosSinRespuesta, seguimientoPermitido)
     VALUES (@participation, @at, 1, @priority, @level, @rule, @trigger, @source, 0, 1)`,
    {
      participation: p.participation,
      at,
      priority,
      level,
      rule: rule ?? { 2: 3, 3: 4, 4: 5 }[priority] ?? 5,
      trigger,
      source,
    },
  );
}
async function closeCase(p, { at, reason, converted = null }) {
  await run(
    `INSERT dbo.EventoCaso (idCaso, idTipoEvento, fechaEvento, idEstadoCasoResultante, idMotivoCierre, idLeadCasoAtribuido)
     VALUES (@caseId, 3, @at, 2, @reason, @converted)`,
    { caseId: p.caseId, at, reason, converted },
  );
  await run(
    'UPDATE dbo.LeadCaso SET idEstadoParticipacion = CASE WHEN idLeadCaso = @converted THEN 4 ELSE 3 END, idMotivoSuspension = NULL WHERE idCaso = @caseId',
    { caseId: p.caseId, converted },
  );
}
async function caseEvent(p, { type, at, stage = null, proposal = null }) {
  return insert(
    db,
    `INSERT dbo.EventoCaso (idCaso, idTipoEvento, fechaEvento, idLeadCasoAtribuido, idPropuestaAceptada, idEtapaResultante, idOperador)
     VALUES (@caseId, @type, @at, @participation, @proposal, @stage, @operator)`,
    {
      caseId: p.caseId,
      type,
      at,
      participation: p.participation,
      proposal,
      stage,
      operator: [7, 8].includes(type) ? await getOperator(db) : null,
    },
  );
}
async function proposal(p, { deliveredDaysAgo, tariff = 2 }) {
  const inbound = await message(p, {
    direction: 1,
    at: lima(deliveredDaysAgo, -1),
    text: 'Quiero contratar Meta UNT mensual',
  });
  const outbound = await message(p, {
    direction: 2,
    origin: 2,
    replied: inbound,
    at: lima(deliveredDaysAgo),
    text: 'Propuesta Meta UNT. Precio autorizado S/ 79.90 por periodo contratado.',
  });
  const price = (
    await one('SELECT precio FROM dbo.PlanTarifa WHERE idPlanTarifa = @tariff', { tariff })
  ).precio;
  const id = await insert(
    db,
    `INSERT dbo.PropuestaComercial (idCaso, idLeadCasoEntrega, idPlanTarifa, precioAutorizado, idMensajeEntrega)
     VALUES (@caseId, @participation, @tariff, @price, @outbound)`,
    { caseId: p.caseId, participation: p.participation, tariff, price, outbound },
  );
  return { id, price, inbound };
}

const seeded = {};
await transaction(async (connection) => {
  db = connection;
  // E1: tres intentos entregados sin respuesta → Baja (sección 2.5, umbral de Baja).
  const e1 = await lead('E1', 'Tres sin respuesta', { daysAgo: 6 });
  await evaluation(e1, { at: lima(6, 2), priority: 3, level: 2, rule: 4 });
  await deliverAttempts(e1, [1, 2, 3]);
  const greeting = await message(e1, { direction: 1, at: lima(6, 0.3), text: 'Hola' });
  const asked = await message(e1, {
    direction: 2,
    origin: 2,
    replied: greeting,
    at: lima(6, 0.5),
    text: '¿Qué carrera te gustaría estudiar?',
  });
  await run(
    'INSERT dbo.PreguntaPerfil (idLeadCaso, idContacto, idCampoPerfil, idMensajePregunta, fechaPregunta) VALUES (@participation, @contact, 2, @asked, @at)',
    { ...e1, asked, at: lima(6, 0.5) },
  );
  seeded.E1 = e1;

  // E2 y E3: siete intentos entregados sin respuesta → Nula y Suspendida.
  for (const code of ['E2', 'E3']) {
    const p = await lead(code, code === 'E2' ? 'Siete sin respuesta' : 'Reactivacion desde Nula', {
      daysAgo: 36,
    });
    await evaluation(p, { at: lima(36, 2), priority: 4, level: 1 });
    await deliverAttempts(p, [1, 2, 3, 4, 5, 6, 7]);
    seeded[code] = p;
  }

  // E4: participación Activa en Alta evaluada hace 8 días → reevaluación semanal.
  const e4 = await lead('E4', 'Reevaluacion semanal', { daysAgo: 20 });
  await omitAttempts(e4);
  await message(e4, { direction: 1, at: lima(8, -1), text: 'Quiero contratar Meta UNT' });
  await evaluation(e4, { at: lima(8), priority: 2, level: 3, trigger: 2 });
  seeded.E4 = e4;

  // E5: derivación abierta hace 26 horas sin atender → el agente retoma.
  const e5 = await lead('E5', 'Derivacion vencida', { daysAgo: 3 });
  await omitAttempts(e5);
  const asks = await message(e5, {
    direction: 1,
    channel: 3,
    at: lima(1, -2),
    text: 'Quiero hablar con una persona',
  });
  await run(
    'INSERT dbo.Derivacion (idContacto, idMotivoDerivacion, idMensajeOrigen, fechaInicio) VALUES (@contact, 1, @asks, @at)',
    { contact: e5.contact, asks, at: lima(1, -2) },
  );
  seeded.E5 = e5;

  // E6: propuesta entregada hace 9 días sin respuesta.
  const e6 = await lead('E6', 'Propuesta sin respuesta', { daysAgo: 12 });
  await omitAttempts(e6);
  seeded.E6 = { ...e6, proposal: await proposal(e6, { deliveredDaysAgo: 9 }) };

  // E7: prueba Explora UNT que terminó ayer.
  const e7 = await lead('E7', 'Explora vencida', { daysAgo: 16 });
  await omitAttempts(e7);
  await run(
    'INSERT dbo.PruebaGratuita (idBeneficiario, idLeadCaso, fechaInicio, fechaFin, idEstadoPrueba) VALUES (@beneficiary, @participation, @start, @end, 1)',
    { ...e7, start: lima(15), end: lima(1) },
  );
  seeded.E7 = e7;

  // E8: caso sin actividad desde hace más de 30 días → cierre sin seguimiento viable.
  const e8 = await lead('E8', 'Caso inactivo', { daysAgo: 75 });
  await omitAttempts(e8);
  await message(e8, { direction: 1, at: lima(60), text: 'Gracias, lo voy a pensar' });
  seeded.E8 = e8;

  // E9 y E10: casos cerrados por desistimiento hace 10 y 35 días.
  for (const [code, label, closedDaysAgo] of [
    ['E9', 'Reapertura en plazo', 10],
    ['E10', 'Fuera de plazo', 35],
  ]) {
    const p = await lead(code, label, { daysAgo: closedDaysAgo + 5 });
    await omitAttempts(p);
    const last = await message(p, {
      direction: 1,
      at: lima(closedDaysAgo, -1),
      text: 'Ya no me interesa, gracias',
    });
    void last;
    await closeCase(p, { at: lima(closedDaysAgo), reason: 3 });
    seeded[code] = p;
  }

  // E11: solicitud provisional de hace 31 días sin mensajes → Descartada.
  const contact = await insert(
    db,
    `INSERT dbo.Contacto (nombreCompleto, correo, telefono, fechaRegistro) VALUES (N'Escenario E11 Solicitud provisional', N'escenario.e11@example.test', N'+51900000011', @at)`,
    { at: lima(31) },
  );
  await run(
    `INSERT dbo.SolicitudProvisional (idContacto, idRolContacto, idCanalCaptacion, fechaSolicitud, textoSolicitud) VALUES (@contact, 2, 1, @at, N'Interés en Meta UNT. Beneficiario pendiente.')`,
    { contact, at: lima(31) },
  );
  seeded.E11 = { contact };

  // E12: conversión completa con ventanas cerradas (propuesta, aceptación, Alta, pago y validación).
  const e12 = await lead('E12', 'Conversion cerrada', { daysAgo: 25 });
  await deliverAttempts(e12, [1]);
  await message(e12, { direction: 1, at: lima(25, 5), text: 'Hola, quiero información' });
  const offer = await proposal(e12, { deliveredDaysAgo: 20 });
  const accepted = await message(e12, {
    direction: 1,
    channel: 4,
    at: lima(19),
    text: 'Acepto expresamente la propuesta y sus condiciones.',
  });
  await run(
    'UPDATE dbo.PropuestaComercial SET idResultado = 1, aceptacionExpresa = 1, idLeadCasoAcepta = @participation, idMensajeRespuesta = @accepted WHERE idPropuesta = @id',
    { participation: e12.participation, accepted, id: offer.id },
  );
  await evaluation(e12, { at: lima(19), priority: 2, level: 3, trigger: 6 });
  const acceptance = await caseEvent(e12, { type: 5, at: lima(19, 1), proposal: offer.id });
  const contract = await insertContract(db, {
    caseId: e12.caseId,
    proposal: offer.id,
    event: acceptance,
    stage: 1,
  });
  await savePayment(
    db,
    contract,
    await caseEvent(e12, { type: 6, at: lima(18) }),
    'escenario_pago_e12',
    offer.price,
  );
  await saveValidation(db, contract, await caseEvent(e12, { type: 7, at: lima(17), stage: 2 }));
  await closeCase(e12, { at: lima(17, 1), reason: 1, converted: e12.participation });
  seeded.E12 = e12;

  // E13: pregunta de perfil respondida al día siguiente, con la ventana ya cerrada (L-2.1).
  const e13 = await lead('E13', 'Perfil respondido', { daysAgo: 14 });
  await deliverAttempts(e13, [1]);
  const hello = await message(e13, { direction: 1, at: lima(14, 2), text: 'Hola' });
  const question = await message(e13, {
    direction: 2,
    origin: 2,
    replied: hello,
    at: lima(14, 3),
    text: '¿Qué carrera te gustaría estudiar?',
  });
  const ask = await insert(
    db,
    'INSERT dbo.PreguntaPerfil (idLeadCaso, idContacto, idCampoPerfil, idMensajePregunta, fechaPregunta) VALUES (@participation, @contact, 2, @question, @at)',
    { ...e13, question, at: lima(14, 3) },
  );
  const answer = await message(e13, { direction: 1, at: lima(13), text: 'Medicina Humana' });
  await run(
    `INSERT dbo.CambioPerfil (idPregunta, idLeadCaso, idContactoInformante, idTipoTitular, idBeneficiarioTitular, idCampoPerfil,
       fechaRespuesta, datoNuevo, idTipoCambio, idCanal, idRolReferencia, idMensajeRespuesta)
     VALUES (@ask, @participation, @contact, 2, @beneficiary, 2, @at, N'Medicina Humana', 1, 2, 1, @answer)`,
    { ...e13, ask, at: lima(13), answer },
  );
  await run(
    "UPDATE dbo.PerfilBeneficiario SET carreraDeseada = N'Medicina Humana' WHERE idBeneficiario = @beneficiary",
    e13,
  );
  seeded.E13 = e13;
});

db = base;
const origin = process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3067}`;
const lateOffer = await createOfferLink(seeded.E6.proposal.id, origin);
console.log(`\n13 escenarios sembrados en ${database}.`);
console.log(`Enlace para aceptar tarde la propuesta de E6 (vence en 7 días): ${lateOffer.url}`);

if (apply) {
  const result = await reviewFollowup({ prepare: false });
  console.log(
    `Revisión aplicada: ${result.evaluated} evaluaciones, ${result.closed} casos cerrados.`,
  );
}

const states = await run(
  `SELECT c.nombreCompleto contacto, p.nombre prioridad, ep.nombre participacion, ec.nombre caso
   FROM dbo.Contacto c
   JOIN dbo.Lead l ON l.idContacto = c.idContacto
   JOIN dbo.LeadCaso lc ON lc.idLead = l.idLead
   JOIN dbo.Caso ca ON ca.idCaso = lc.idCaso
   JOIN dbo.Cat_Prioridad p ON p.id = lc.idPrioridadActual
   JOIN dbo.Cat_EstadoParticipacion ep ON ep.id = lc.idEstadoParticipacion
   JOIN dbo.Cat_EstadoCaso ec ON ec.id = ca.idEstadoCaso
   WHERE c.correo LIKE N'escenario.e%@example.test'
   ORDER BY c.idContacto`,
);
console.table(states.recordset);
await close();
process.exit(0);
