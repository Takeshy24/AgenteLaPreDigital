import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { close, query, rollbackTest, transaction } from '../server/db.mjs';
import { getOperator, insert } from '../server/shared/repository.mjs';
import { ensureProfiles } from '../server/leads/repository.mjs';
import { initializeDataMart, refreshDataMart } from '../server/datamart/service.mjs';

export async function seedIndicatorScenarios(db, { now = Date.now() } = {}) {
  const old = (
    await query(
      db,
      "SELECT correo FROM dbo.Contacto WHERE correo LIKE N'indicador.i%@example.test'",
    )
  ).recordset;
  if (old.length) {
    if (old.length !== 10)
      throw new Error(
        'El seed de indicadores está incompleto. Revisa sus contactos antes de repetirlo.',
      );
    return { existing: true, cases: 8, contacts: 10 };
  }
  const local = new Date(now - 5 * 3600000);
  const origin = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 2, 28, 10);
  const at = (hours = 0) => new Date(origin + hours * 3600000).toISOString().slice(0, 19);
  const operator = await getOperator(db);
  const one = async (sql, params) => (await query(db, sql, params)).recordset[0];
  const run = (sql, params) => query(db, sql, params);
  const scenarios = {};
  const tariffs = {};
  for (const plan of [1, 2, 3]) {
    tariffs[plan] = await one(
      `SELECT TOP (1) idPlanTarifa, precio FROM dbo.PlanTarifa
WHERE idPlan = @plan AND idModalidad = 1 AND vigenciaDesde <= CAST(@at AS DATE)
    AND (vigenciaHasta IS NULL OR vigenciaHasta >= CAST(@at AS DATE))
ORDER BY vigenciaDesde DESC, idPlanTarifa DESC`,
      { plan, at: at(48) },
    );
    if (!tariffs[plan])
      throw new Error(`No hay tarifa mensual del plan ${plan} para las fechas del seed.`);
  }
  async function event(p, type, hour, { proposal = null, stage = null, reason = null } = {}) {
    return insert(
      db,
      `INSERT dbo.EventoCaso (idCaso, idTipoEvento, fechaEvento, idLeadCasoAtribuido,
idPropuestaAceptada, idEtapaResultante, idEstadoCasoResultante, idMotivoCierre, idOperador)
VALUES (@caseId, @type, @at, @participation, @proposal, @stage, @state, @reason, @operator)`,
      {
        caseId: p.caseId,
        type,
        at: at(hour),
        participation: p.participation ?? null,
        proposal,
        stage,
        state: type === 3 ? 2 : null,
        reason,
        operator: [7, 8].includes(type) ? operator : null,
      },
    );
  }
  async function evaluation(p, hour, level = 1, trigger = 1) {
    const priority = level >= 3 ? 2 : level === 2 ? 3 : 4;
    const id = await insert(
      db,
      `INSERT dbo.EvaluacionPrioridad (idLeadCaso, fechaEvaluacion, idPrioridadAnterior,
idPrioridadAsignada, idNivelInteres, idReglaAplicada, idDisparador, idFuenteNivel, intentosSinRespuesta, seguimientoPermitido)
VALUES (@participation, @at, @previous, @priority, @level, @rule, @trigger, 2, 0, 1)`,
      {
        participation: p.participation,
        at: at(hour),
        previous: p.priority ?? 1,
        priority,
        level,
        rule: { 2: 3, 3: 4, 4: 5 }[priority],
        trigger,
      },
    );
    p.priority = priority;
    return id;
  }
  async function consent(p, hour, channel = p.channel) {
    const id = await insert(
      db,
      `INSERT dbo.AutorizacionContacto (idContacto, idCanal, idEstadoAutorizacion,
fechaOtorgamiento, idOrigenAutorizacion, versionTexto)
VALUES (@contact, @channel, 1, @at, @source, N'seed-indicadores-v1')`,
      {
        contact: p.contact,
        channel,
        at: at(hour),
        source: p.guardian ? 2 : 1,
      },
    );
    p.authorizations[channel] = id;
    return id;
  }
  async function participant(
    code,
    label,
    { role = 1, channel = 2, student = null, hour = 0 } = {},
  ) {
    const name = `Indicador ${code} ${label}`;
    const contact = await insert(
      db,
      `INSERT dbo.Contacto (nombreCompleto, correo, telefono, fechaRegistro)
VALUES (@name, @email, @phone, @at)`,
      {
        name,
        email: `indicador.${code.toLowerCase()}@example.test`,
        phone: `+51910000${String(code.replace(/\D/g, '')).padStart(3, '0')}`,
        at: at(hour),
      },
    );
    const beneficiary =
      student?.beneficiary ??
      (await insert(
        db,
        `INSERT dbo.Beneficiario
(nombreCompleto, nombreNormalizado, idContactoBeneficiario) VALUES (@name, UPPER(@name), @contact)`,
        {
          name: role === 1 ? name : `Estudiante ${name}`,
          contact: role === 1 ? contact : null,
        },
      ));
    await ensureProfiles(db, { contact, beneficiary });
    const lead = await insert(
      db,
      `INSERT dbo.Lead (idContacto, idBeneficiario, idRolContacto, idCanalCaptacion, fechaCaptacion)
VALUES (@contact, @beneficiary, @role, 1, @at)`,
      { contact, beneficiary, role, at: at(hour) },
    );
    const caseId =
      student?.caseId ??
      (await insert(
        db,
        'INSERT dbo.Caso (idBeneficiario, fechaApertura) VALUES (@beneficiary, @at)',
        { beneficiary, at: at(hour) },
      ));
    const p = {
      code,
      contact,
      beneficiary,
      lead,
      caseId,
      role,
      channel,
      authorizations: {},
      guardian: Boolean(student),
    };
    if (!student) {
      await event(p, 1, hour, { stage: 1 });
      await event(p, 2, hour);
    }
    await consent(p, hour);
    p.participation = await insert(
      db,
      `INSERT dbo.LeadCaso
(idLead, idCaso, idRolContacto, fechaIncorporacion, fechaInicioElegibilidad)
VALUES (@lead, @caseId, @role, @at, @at)`,
      { lead, caseId, role, at: at(hour) },
    );
    for (const [index, day] of [0, 1, 2, 5, 10, 17, 27].entries()) {
      await run(
        'INSERT dbo.IntentoContacto (idLeadCaso, numeroIntento, fechaProgramada) VALUES (@id, @number, @at)',
        { id: p.participation, number: index + 1, at: at(hour + day * 24) },
      );
    }
    await evaluation(p, hour + 0.25);
    return p;
  }
  async function message(
    p,
    hour,
    {
      incoming = false,
      reply = null,
      channel = p.channel,
      text = 'Mensaje simulado para indicadores',
    } = {},
  ) {
    if (!incoming && !reply && !p.authorizations[channel]) await consent(p, 0, channel);
    return insert(
      db,
      `INSERT dbo.Mensaje (idContacto, idLead, idLeadCaso, idDireccion, idCanal,
fechaHora, idOrigenMensaje, idAutorizacionAlEnvio, idMensajeRespondido, textoMensaje, idEstadoEntrega, fechaEntrega)
VALUES (@contact, @lead, @participation, @direction, @channel, @at, @origin, @authorization,
@reply, @text, @state, @delivered)`,
      {
        contact: p.contact,
        lead: p.lead,
        participation: p.participation,
        direction: incoming ? 1 : 2,
        channel,
        at: at(hour),
        origin: incoming ? null : reply ? 2 : 1,
        authorization: incoming || reply ? null : p.authorizations[channel],
        reply,
        text,
        state: incoming ? null : 2,
        delivered: incoming ? null : at(hour),
      },
    );
  }
  async function initial(p, answered = true) {
    const sent = await message(p, 1);
    await run(
      'UPDATE dbo.IntentoContacto SET idMensajeEnvio = @sent WHERE idLeadCaso = @id AND numeroIntento = 1',
      { sent, id: p.participation },
    );
    if (answered) {
      p.incoming = await message(p, 2, {
        incoming: true,
        reply: sent,
        text: 'Hola, quiero información',
      });
      await evaluation(p, 2, 2, 2);
      await run(
        'UPDATE dbo.IntentoContacto SET idMensajeRespuesta = @reply WHERE idLeadCaso = @id AND numeroIntento = 1',
        { reply: p.incoming, id: p.participation },
      );
    }
  }
  async function question(p, hour, channel = p.channel) {
    const sent = await message(p, hour, {
      reply: p.incoming,
      channel,
      text: '¿Qué carrera deseas estudiar?',
    });
    return insert(
      db,
      `INSERT dbo.PreguntaPerfil (idLeadCaso, idContacto, idCampoPerfil, idMensajePregunta, fechaPregunta)
VALUES (@participation, @contact, 2, @message, @at)`,
      { participation: p.participation, contact: p.contact, message: sent, at: at(hour) },
    );
  }
  async function proposal(p, plan = 2, hour = 48, accepted = true) {
    const inbound = await message(p, hour - 0.5, {
      incoming: true,
      text: 'Quiero contratar el plan',
    });
    p.incoming = inbound;
    await evaluation(p, hour - 0.5, 3, 2);
    p.high ??= hour - 0.5;
    const outbound = await message(p, hour, {
      reply: inbound,
      text: `Propuesta simulada del plan ${plan}`,
    });
    const tariff = tariffs[plan];
    const id = await insert(
      db,
      `INSERT dbo.PropuestaComercial
(idCaso, idLeadCasoEntrega, idPlanTarifa, precioAutorizado, idMensajeEntrega)
VALUES (@caseId, @participation, @tariff, @price, @message)`,
      {
        caseId: p.caseId,
        participation: p.participation,
        tariff: tariff.idPlanTarifa,
        price: tariff.precio,
        message: outbound,
      },
    );
    let acceptance = null;
    if (accepted) {
      const reply = await message(p, hour + 24, {
        incoming: true,
        channel: 4,
        text: 'Acepto la propuesta y las condiciones (simulación)',
      });
      await run(
        `UPDATE dbo.PropuestaComercial SET idResultado = 1, aceptacionExpresa = 1,
idLeadCasoAcepta = @participation, idMensajeRespuesta = @reply WHERE idPropuesta = @id`,
        { participation: p.participation, reply, id },
      );
      acceptance = await event(p, 5, hour + 24, { proposal: id });
      await evaluation(p, hour + 24, 3, 6);
    }
    return { id, price: tariff.precio, acceptance };
  }
  async function closeCase(p, hour = 240, reason = 3, converted = false) {
    if (reason === 3)
      await message(p, hour, { incoming: true, text: 'Desisto de esta negociación (simulación)' });
    await event(p, 3, hour, { reason });
    await run(
      `UPDATE dbo.LeadCaso SET idEstadoParticipacion = CASE WHEN idLeadCaso = @converted THEN 4 ELSE 3 END,
idMotivoSuspension = NULL WHERE idCaso = @caseId`,
      { caseId: p.caseId, converted: converted ? p.participation : null },
    );
    await run(
      `UPDATE i SET omitido = 1 FROM dbo.IntentoContacto AS i
INNER JOIN dbo.LeadCaso AS lc ON lc.idLeadCaso = i.idLeadCaso
WHERE lc.idCaso = @caseId AND i.idMensajeEnvio IS NULL`,
      { caseId: p.caseId },
    );
  }
  async function contract(p, offer, { refund = false, late = false } = {}) {
    const payment = await event(p, 6, 74);
    const validationHour = late ? p.high + 168 + 1 / 3600 : 75;
    const validation = await event(p, 7, validationHour, { stage: 2 });
    await insert(
      db,
      `INSERT dbo.Contratacion (idCaso, idPropuestaAceptada, idEventoAceptacion,
idEventoPago, idEventoValidacion, referenciaPago, importeConfirmado)
VALUES (@caseId, @proposal, @acceptance, @payment, @validation, @reference, @amount)`,
      {
        caseId: p.caseId,
        proposal: offer.id,
        acceptance: offer.acceptance,
        payment,
        validation,
        reference: `SIMULADO-${p.code}`,
        amount: offer.price,
      },
    );
    await closeCase(p, validationHour, 1, true);
    if (refund) {
      const incident = await event(p, 9, 120, { stage: 1 });
      await run(
        'INSERT dbo.BloqueoPromocional (idBeneficiario, idMotivoBloqueo, idEventoOrigen) VALUES (@beneficiary, 1, @incident)',
        { beneficiary: p.beneficiary, incident },
      );
    }
  }
  scenarios.I01 = await participant('I01', 'Conversión y detalle múltiple');
  const first = scenarios.I01;
  await initial(first);
  await consent(first, 0, 3);
  const asked = await question(first, 4);
  await question(first, 5, 3);
  const answer = await message(first, 12, { incoming: true, text: 'Medicina Humana' });
  await run(
    `INSERT dbo.CambioPerfil (idPregunta, idLeadCaso, idContactoInformante, idTipoTitular,
idBeneficiarioTitular, idCampoPerfil, fechaRespuesta, datoNuevo, idTipoCambio, idCanal, idRolReferencia, idMensajeRespuesta)
VALUES (@question, @participation, @contact, 2, @beneficiary, 2, @at, N'Medicina Humana', 1, 2, 1, @answer)`,
    {
      question: asked,
      participation: first.participation,
      contact: first.contact,
      beneficiary: first.beneficiary,
      at: at(12),
      answer,
    },
  );
  await run(
    "UPDATE dbo.PerfilBeneficiario SET carreraDeseada = N'Medicina Humana' WHERE idBeneficiario = @id",
    { id: first.beneficiary },
  );
  await proposal(first, 1, 48, false);
  await contract(first, await proposal(first, 2, 49));
  scenarios.I02 = await participant('I02', 'Sin respuesta ni aceptación', { channel: 1 });
  await initial(scenarios.I02, false);
  await proposal(scenarios.I02, 3, 200, false);
  await question(scenarios.I02, 201);
  await closeCase(scenarios.I02);
  for (const [code, delayed, role] of [
    ['I03', false, 2],
    ['I04', true, 3],
  ]) {
    const p = (scenarios[code] = await participant(
      code,
      delayed ? 'Autorizaciones sin coincidencia oportuna' : 'Vinculación autorizada',
      { channel: 3 },
    ));
    await initial(p);
    const evidence = await message(p, 3, {
      incoming: true,
      text: 'Mi familia se hará cargo del pago',
    });
    const need = await insert(
      db,
      'INSERT dbo.NecesidadVinculacion (idCaso, idLeadCasoDeclara, idMensajeEvidencia, fechaNecesidad) VALUES (@caseId, @id, @message, @at)',
      { caseId: p.caseId, id: p.participation, message: evidence, at: at(3) },
    );
    const responsible = await participant(`${code}R`, 'Responsable económico', {
      role,
      student: p,
      hour: 24,
    });
    const linked = delayed ? 72 : 24;
    const invitation = await insert(
      db,
      `INSERT dbo.InvitacionVinculacion (idNecesidad, nombreInvitado,
idRolInvitado, idResponsable, idLeadCasoResponsable, fechaInvitacion, fechaVinculacion)
VALUES (@need, @name, @role, @contact, @id, @invited, @linked)`,
      {
        need,
        name: `Responsable ${code}`,
        role,
        contact: responsible.contact,
        id: responsible.participation,
        invited: at(3),
        linked: at(linked),
      },
    );
    await run(
      'INSERT dbo.AutorizacionVinculacion (idInvitacion, idEstadoAutorizacion, fechaOtorgamiento) VALUES (@id, 1, @at)',
      { id: invitation, at: at(linked) },
    );
    if (delayed) {
      await run(
        'UPDATE dbo.AutorizacionContacto SET idEstadoAutorizacion = 2, fechaRevocacion = @at WHERE idAutorizacion = @id',
        { at: at(25), id: responsible.authorizations[responsible.channel] },
      );
      await consent(responsible, 203);
      const repeated = await message(p, 96, {
        incoming: true,
        text: 'Sigue pendiente el responsable',
      });
      await run(
        'INSERT dbo.NecesidadVinculacion (idCaso, idLeadCasoDeclara, idMensajeEvidencia, fechaNecesidad) VALUES (@caseId, @id, @message, @at)',
        { caseId: p.caseId, id: p.participation, message: repeated, at: at(96) },
      );
    }
    await closeCase(responsible);
  }
  scenarios.I05 = await participant('I05', 'Beca completa');
  await initial(scenarios.I05);
  await proposal(scenarios.I05, 2, 48, false);
  const scholarship = await event(scenarios.I05, 8, 96, { stage: 3 });
  await run(
    `INSERT dbo.BecaCompleta (idEvento, idPlan, fechaAutorizacion, idOperadorAutoriza, fechaFinVigencia, fechaHabilitacion)
VALUES (@event, 2, @authorized, @operator, @end, @enabled)`,
    {
      event: scholarship,
      authorized: at(60),
      operator,
      end: at(24 * 40).slice(0, 10),
      enabled: at(96),
    },
  );
  await closeCase(scenarios.I05, 96, 2);
  for (const [code, label, options] of [
    ['I06', 'Reembolso dentro de ventana', { refund: true }],
    ['I07', 'Validación un segundo tarde', { late: true }],
  ]) {
    const p = (scenarios[code] = await participant(code, label));
    await initial(p);
    await contract(p, await proposal(p), options);
  }
  scenarios.I08 = await participant('I08', 'Seguimiento sin entrega', { role: 4, channel: 1 });
  await closeCase(scenarios.I08);
  return { existing: false, cases: 8, contacts: 10, scenarios, origin: at() };
}

async function main() {
  const check = process.argv.includes('--check');
  if (!check && !process.argv.includes('--yes')) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      'Se agregarán 8 casos simulados y se recargará el DataMart. ¿Continuar? (s/N) ',
    );
    rl.close();
    if (!/^s$/i.test(answer.trim())) return;
  }
  await initializeDataMart();
  const result = await (check ? rollbackTest : transaction)(async (db) => {
    const seeded = await seedIndicatorScenarios(db);
    await refreshDataMart();
    return seeded;
  });
  console.log(
    check
      ? 'Seed y ETL validados; se revirtieron los escenarios de prueba.'
      : result.existing
        ? 'El seed ya existía; DataMart actualizado sin duplicar escenarios.'
        : '8 casos y 10 contactos simulados creados. DataMart actualizado.',
  );
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await close();
  }
}
