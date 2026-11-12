import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';
import { app } from '../app.mjs';
import { close } from '../db.mjs';
import {
  conversionRows,
  initialContactRows,
  linkingRows,
  profileRows,
  proposalRows,
  toMs,
} from '../kpis/cohorts.mjs';
import { computeKpi, KPI_DEFINITIONS, stateOf } from '../kpis/rules.mjs';

const definition = (id) => KPI_DEFINITIONS.find((item) => item.id === id);
const noFilters = {
  from: null,
  to: null,
  grain: 'month',
  contactId: null,
  channel: null,
  role: null,
  plan: null,
};
const after = (start, hours) =>
  new Date(toMs(start) + hours * 3600000 - 5 * 3600000).toISOString().slice(0, 19);
const NOW = toMs('2027-01-01T00:00:00');

test('semáforos: umbrales del informe y denominador cero como No aplicable', () => {
  assert.equal(stateOf(null, [90, 95]).label, 'No aplicable');
  assert.equal(stateOf(89.9, [90, 95]).code, 'critical');
  assert.equal(stateOf(90, [90, 95]).code, 'alert');
  assert.equal(stateOf(95, [90, 95]).code, 'ok');
  assert.deepEqual(
    KPI_DEFINITIONS.map((item) => item.thresholds),
    [
      [90, 95],
      [20, 40],
      [40, 70],
      [30, 60],
      [20, 40],
      [30, 50],
    ],
  );
});

test('L-1: la entrega cuenta hasta las 168 horas exactas y la respuesta debe ser posterior a la primera entrega', () => {
  const start = '2026-10-01T10:00:00';
  const base = { id: 1, contactId: 7, contactName: 'Ana', role: 2, startAt: start };
  const attempt = (hours, state = 2) => [
    {
      id: 1,
      n: 1,
      omitted: 0,
      channel: 2,
      state,
      deliveredAt: state === 2 ? after(start, hours) : null,
    },
  ];
  const reply = (hours) => [{ contactId: 7, id: 1, at: after(start, hours) }];
  const rowsFor = (attempts, incoming) =>
    initialContactRows({ participations: [base], attempts, incoming }, NOW)[0];
  const exact = rowsFor(attempt(168), reply(169));
  assert.equal(exact.flags.m2, true);
  assert.equal(exact.flags.m3, true);
  assert.equal(rowsFor(attempt(168.01), []).flags.m2, false);
  assert.equal(
    rowsFor(attempt(168.01), []).reasons['L-1.1'],
    'Entregado fuera de la ventana de 7 días',
  );
  const before = rowsFor(attempt(2), reply(1));
  assert.equal(before.flags.m3, false);
  assert.equal(
    rowsFor(attempt(2), [{ contactId: 7, id: null, at: after(start, 5) }]).flags.m3,
    true,
  );
  assert.equal(
    rowsFor(attempt(2), [{ contactId: 8, id: null, at: after(start, 5) }]).flags.m3,
    false,
  );
  assert.equal(rowsFor(attempt(2), reply(2 + 168.01)).flags.m3, false);
  assert.equal(exact.channel, 2);
  const none = rowsFor([], []);
  assert.equal(none.channel, 0);
  assert.equal(none.reasons['L-1.1'], 'Sin agenda programada');
  const failed = rowsFor(attempt(0, 3), []);
  assert.equal(failed.reasons['L-1.1'], 'Entrega fallida en el canal');
});

test('L-1.2 solo considera a las participaciones contactadas y marca provisionales las ventanas abiertas', () => {
  const start = '2026-12-31T20:00:00';
  const rows = initialContactRows(
    {
      participations: [
        { id: 1, contactId: 1, contactName: 'A', role: 1, startAt: start },
        { id: 2, contactId: 2, contactName: 'B', role: 1, startAt: start },
      ],
      attempts: [{ id: 1, n: 1, omitted: 0, channel: 3, state: 2, deliveredAt: after(start, 1) }],
      incoming: [],
    },
    NOW,
  );
  const kpi = computeKpi(definition('L-1.2'), rows, noFilters, NOW);
  assert.equal(kpi.denominator, 1);
  assert.equal(kpi.numerator, 0);
  assert.equal(kpi.provisional, 1);
  assert.match(kpi.interpretation, /provisional/);
  const coverage = computeKpi(definition('L-1.1'), rows, noFilters, NOW);
  assert.equal(coverage.denominator, 2);
  assert.equal(coverage.numerator, 1);
});

test('L-2: un contacto cuenta una vez por mes y el error de extracción no cuenta', () => {
  const asked = (day, hour) => ({
    contactId: 5,
    contactName: 'Luis',
    role: 1,
    channel: 3,
    deliveredAt: `2026-10-${day}T${hour}:00:00`,
  });
  const questions = [asked('01', '10'), asked('02', '10'), asked('03', '10')];
  const answered = (type, operator = null) => [
    { contactId: 5, at: '2026-10-02T12:00:00', type, operator },
  ];
  const rows = (changes) => profileRows({ questions, changes }, NOW);
  assert.equal(rows(answered(1)).length, 1);
  assert.equal(rows(answered(1))[0].flags.m5, true);
  assert.equal(rows(answered(3))[0].flags.m5, false);
  assert.equal(rows(answered(2, 9))[0].flags.m5, false);
  assert.equal(
    rows([{ contactId: 6, at: '2026-10-02T12:00:00', type: 1, operator: null }])[0].flags.m5,
    false,
  );
  assert.equal(
    profileRows(
      {
        questions: [...questions, { ...asked('01', '10'), deliveredAt: '2026-11-01T10:00:00' }],
        changes: [],
      },
      NOW,
    ).length,
    2,
  );
});

test('L-3: una necesidad es nueva si las anteriores ya estaban satisfechas y exige vínculo y dos autorizaciones', () => {
  const need = (id, at) => ({
    id,
    caseId: 1,
    at,
    role: 2,
    contactId: 3,
    contactName: 'Mamá',
    channel: 3,
  });
  const linked = (needId, linkedAt, linkAuthAt, contactAuthAt) => ({
    needId,
    linkedAt,
    linkAuthAt,
    contactAuthAt,
  });
  const rows = linkingRows(
    {
      needs: [
        need(1, '2026-10-01T10:00:00'),
        need(2, '2026-10-02T10:00:00'),
        need(3, '2026-11-20T10:00:00'),
      ],
      invitations: [
        linked(1, '2026-10-03T10:00:00', '2026-10-03T10:00:00', '2026-10-03T11:00:00'),
        linked(3, '2026-11-21T10:00:00', null, '2026-11-21T10:00:00'),
      ],
    },
    NOW,
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].flags.m7, true);
  assert.equal(rows[1].originAt, '2026-11-20T10:00:00');
  assert.equal(rows[1].flags.m7, false);
  assert.equal(rows[1].reasons['L-3.1'], 'Invitación sin vincular o sin las dos autorizaciones');
  const pending = linkingRows(
    { needs: [need(1, '2026-10-01T10:00:00'), need(2, '2026-10-02T10:00:00')], invitations: [] },
    NOW,
  );
  assert.equal(pending.length, 1);
});

test('L-4: el caso se cuenta una vez por mes, la aceptación debe ocurrir en 168 horas y los planes no se suman', () => {
  const delivered = '2026-10-05T09:00:00';
  const proposal = (planId, result, acceptedHours) => ({
    caseId: 9,
    planId,
    channel: 3,
    deliveredAt: delivered,
    result,
    accepted: result === 1 ? 1 : 0,
    acceptedAt: acceptedHours == null ? null : after(delivered, acceptedHours),
  });
  const rows = proposalRows(
    { proposals: [proposal(1, 2, null), proposal(2, 1, 168), proposal(3, 1, 169)] },
    NOW,
  );
  const names = { 1: 'Ruta UNT', 2: 'Meta UNT', 3: 'Meta UNT Plus' };
  const all = computeKpi(definition('L-4.1'), rows, noFilters, NOW, { planNames: names });
  assert.equal(all.denominator, 1);
  assert.equal(all.numerator, 1);
  const byPlan = Object.fromEntries(all.breakdown.plan.map((item) => [item.label, item.percent]));
  assert.deepEqual(byPlan, { 'Ruta UNT': 0, 'Meta UNT': 100, 'Meta UNT Plus': 0 });
  const rejected = computeKpi(definition('L-4.1'), rows, { ...noFilters, plan: 1 }, NOW);
  assert.equal(rejected.numerator, 0);
  assert.equal(rejected.causes[0].label, 'Rechazada');
  const ignoresContact = computeKpi(
    definition('L-4.1'),
    rows,
    { ...noFilters, contactId: 123 },
    NOW,
  );
  assert.equal(ignoresContact.denominator, 1);
});

test('L-5: primera Alta por caso, exclusión por beca, pago y validación en la ventana y reembolso', () => {
  const high = (id, caseId, at) => ({
    id,
    caseId,
    at,
    contactId: caseId,
    contactName: `C${caseId}`,
    role: 1,
  });
  const first = '2026-10-01T10:00:00';
  const result = conversionRows(
    {
      highs: [
        high(2, 1, first),
        high(1, 1, first),
        high(3, 1, '2026-10-20T10:00:00'),
        high(4, 2, first),
        high(5, 3, first),
        high(6, 4, first),
        high(7, 5, first),
      ],
      cases: [
        { caseId: 3, reason: 2, closedAt: after(first, 50) },
        { caseId: 4, reason: 1, closedAt: after(first, 90) },
      ],
      contracts: [
        { caseId: 1, paidAt: after(first, 24), validatedAt: after(first, 48), amount: 79.9 },
        { caseId: 2, paidAt: after(first, 24), validatedAt: after(first, 170), amount: 79.9 },
        { caseId: 4, paidAt: after(first, 24), validatedAt: after(first, 48), amount: 79.9 },
      ],
      refunds: [{ caseId: 4, at: after(first, 100) }],
    },
    NOW,
  );
  assert.equal(result.excluded, 1);
  assert.equal(result.rows.length, 4);
  const byCase = Object.fromEntries(result.rows.map((row) => [row.unitKey, row]));
  assert.equal(byCase[1].flags.m11, true);
  assert.equal(byCase[1].originAt, first);
  assert.equal(byCase[2].reasons['L-5.1'], 'Pago sin validación contractual a tiempo');
  assert.equal(byCase[4].reasons['L-5.1'], 'Contratación invalidada por reembolso');
  assert.equal(byCase[5].reasons['L-5.1'], 'Sin contratación');
  const kpi = computeKpi(definition('L-5.1'), result.rows, noFilters, NOW);
  assert.equal(kpi.percent, 25);
  assert.equal(kpi.state.code, 'critical');
  assert.deepEqual(kpi.dimensions, ['time', 'contact', 'role', 'priority']);
});

test('los filtros de período y las dimensiones aplicables siguen la tabla 10', () => {
  const rows = proposalRows(
    {
      proposals: [
        {
          caseId: 1,
          planId: 1,
          channel: 2,
          deliveredAt: '2026-09-10T10:00:00',
          result: 2,
          accepted: 0,
          acceptedAt: null,
        },
        {
          caseId: 2,
          planId: 1,
          channel: 3,
          deliveredAt: '2026-10-10T10:00:00',
          result: 2,
          accepted: 0,
          acceptedAt: null,
        },
      ],
    },
    NOW,
  );
  assert.equal(
    computeKpi(definition('L-4.1'), rows, { ...noFilters, from: '2026-10-01' }, NOW).denominator,
    1,
  );
  assert.equal(
    computeKpi(definition('L-4.1'), rows, { ...noFilters, channel: 2 }, NOW).denominator,
    1,
  );
  assert.equal(
    computeKpi(definition('L-4.1'), rows, { ...noFilters, grain: 'year' }, NOW).breakdown.time[0]
      .key,
    '2026',
  );
  assert.equal(
    computeKpi(definition('L-4.1'), rows, { ...noFilters, grain: 'quarter' }, NOW).breakdown.time[0]
      .key,
    '2026-T3',
  );
  assert.equal(
    computeKpi(definition('L-4.1'), rows, { ...noFilters, grain: 'day' }, NOW).breakdown.time
      .length,
    2,
  );
  assert.equal(
    computeKpi(definition('L-4.1'), rows, { ...noFilters, from: '2030-01-01' }, NOW).state.label,
    'No aplicable',
  );
});

test('API: /api/kpis responde los seis indicadores y el reporte es un PDF válido', async () => {
  const server = http.createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${base}/api/kpis?grain=month&channel=2`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(
      body.kpis.map((item) => item.id),
      ['L-1.1', 'L-1.2', 'L-2.1', 'L-3.1', 'L-4.1', 'L-5.1'],
    );
    assert.match(body.source, /DataMart/);
    assert.deepEqual(
      body.options.channels.map((channel) => channel.id),
      [0, 1, 2, 3],
    );
    const refreshed = await fetch(`${base}/api/kpis/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(refreshed.status, 200);
    assert.match((await refreshed.json()).database, /DataMart/);
    assert.equal((await fetch(`${base}/api/kpis?from=2026-12-01&to=2026-01-01`)).status, 400);
    assert.equal((await fetch(`${base}/api/kpis?grain=semana`)).status, 400);
    const pdf = await fetch(`${base}/api/kpis/report.pdf?grain=month`);
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get('content-type'), /application\/pdf/);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.ok(bytes.length > 3000);
  } finally {
    server.close();
    await close();
  }
});
