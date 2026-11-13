import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { KPI_DEFINITIONS } from '../kpis/rules.mjs';

const source = await readFile(
  new URL('../../src/features/kpis/filter-impact.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { filterImpact } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);
const empty = { from: '', to: '', grain: 'month', contact: '', channel: '', role: '', plan: '' };
const affected = (filters, focus) =>
  KPI_DEFINITIONS.filter((kpi) => filterImpact(kpi.dimensions, filters, focus).affected).map(
    (kpi) => kpi.id,
  );

test('la visualización de filtros usa las dimensiones reales del cálculo', () => {
  assert.deepEqual(affected({ ...empty, plan: '1' }, 'plan'), ['L-4.1']);
  assert.ok(!affected({ ...empty, channel: '1' }, 'channel').includes('L-5.1'));
  for (const field of ['contact', 'role']) {
    const ids = affected({ ...empty, [field]: '1' }, field);
    assert.equal(ids.length, 5);
    assert.ok(!ids.includes('L-4.1'));
  }
  assert.equal(affected({ ...empty, from: '2026-01-01' }, 'from').length, 6);
});

test('el último filtro señala su alcance aunque haya otros filtros aplicados', () => {
  const filters = { ...empty, from: '2026-01-01', to: '2026-12-31', plan: '1', channel: '1' };
  assert.deepEqual(affected(filters, 'plan'), ['L-4.1']);
  const conversion = KPI_DEFINITIONS.find((kpi) => kpi.id === 'L-5.1');
  const impact = filterImpact(conversion.dimensions, filters, 'plan');
  assert.equal(impact.state, 'unaffected');
  assert.deepEqual(impact.applied, ['Periodo']);
  assert.deepEqual(impact.ignored, ['Canal', 'Plan']);
});

test('sin filtros no atenúa tarjetas; agrupar el tiempo señala solo el desglose', () => {
  for (const kpi of KPI_DEFINITIONS)
    assert.equal(filterImpact(kpi.dimensions, empty, null).state, 'neutral');
  for (const kpi of KPI_DEFINITIONS) {
    const impact = filterImpact(kpi.dimensions, { ...empty, grain: 'year' }, 'grain');
    assert.equal(impact.state, 'affected');
    assert.deepEqual(impact.applied, []);
    assert.deepEqual(impact.ignored, []);
  }
});
