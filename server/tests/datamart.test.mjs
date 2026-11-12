import assert from 'node:assert/strict';
import test from 'node:test';
import { query, rollbackTest, close } from '../db.mjs';
import { initializeDataMart, refreshDataMart, martTable } from '../datamart/service.mjs';
import { seedIndicatorScenarios } from '../../tools/seed-indicators.mjs';
import { getKpis } from '../kpis/service.mjs';
import { computeKpi, KPI_DEFINITIONS } from '../kpis/rules.mjs';
import { proposalRows } from '../kpis/datamart-rows.mjs';
import * as repository from '../kpis/repository.mjs';

process.env.DB_DATABASE = 'LaPreDigital_OLTP_test';
process.env.DATAMART_DATABASE = 'LaPreDigital_DataMart_test';
const filters = {
  from: null,
  to: null,
  grain: 'month',
  contactId: null,
  channel: null,
  role: null,
  plan: null,
};
const now = Date.parse('2026-11-12T12:00:00-05:00');

test('seed OLTP → ETL → indicadores del DataMart: ventanas, conteos únicos, beca, reembolso y recarga', async () => {
  try {
    await initializeDataMart({ rebuild: true });
    await rollbackTest(async (db) => {
      const factTables = [
        'HechoContactoInicial',
        'HechoAmpliacionPerfil',
        'HechoVinculacionEconomica',
        'HechoPropuestaComercial',
        'HechoConversionPagada',
      ];
      const dimensionTables = [
        'DimTiempo',
        'DimContacto',
        'DimCanal',
        'DimRolContacto',
        'DimPlan',
        'DimPrioridad',
        'DimCaso',
      ];
      for (const table of [...factTables, ...dimensionTables])
        await query(db, `DELETE FROM ${martTable(table)}`);
      for (const table of dimensionTables) {
        await query(db, 'EXEC LaPreDigital_DataMart_test.sys.sp_executesql @stmt = @sql', {
          sql: `DBCC CHECKIDENT (N'dbo.${table}', RESEED, 1000) WITH NO_INFOMSGS`,
        });
      }
      const seeded = await seedIndicatorScenarios(db, { now });
      assert.equal(
        seeded.existing,
        false,
        'La base de prueba no debe contener este seed previamente',
      );
      assert.equal((await seedIndicatorScenarios(db, { now })).existing, true);
      await refreshDataMart();
      const identities = (
        await query(
          db,
          `SELECT t.name AS tabla, c.name AS columna
FROM LaPreDigital_DataMart_test.sys.tables AS t
INNER JOIN LaPreDigital_DataMart_test.sys.columns AS c ON c.object_id = t.object_id
WHERE c.is_identity = 1 AND t.name LIKE N'Dim%'`,
        )
      ).recordset;
      assert.equal(identities.length, 7, 'Cada dimensión tiene una Key surrogate IDENTITY');
      assert.ok(identities.every((column) => column.columna.startsWith('Key')));
      const factColumns = (
        await query(
          db,
          `SELECT t.name AS tabla, c.name AS columna, ty.name AS tipo
FROM LaPreDigital_DataMart_test.sys.tables AS t
INNER JOIN LaPreDigital_DataMart_test.sys.columns AS c ON c.object_id = t.object_id
INNER JOIN LaPreDigital_DataMart_test.sys.types AS ty ON ty.user_type_id = c.user_type_id
WHERE t.name LIKE N'Hecho%'`,
        )
      ).recordset;
      assert.ok(factColumns.every((column) => /^(Key\w+|M\d+)$/.test(column.columna)));
      assert.ok(factColumns.every((column) => ['int', 'bigint', 'tinyint'].includes(column.tipo)));
      const relations = (
        await query(
          db,
          `SELECT pc.name AS origen, rc.name AS destino
FROM LaPreDigital_DataMart_test.sys.foreign_key_columns AS fk
INNER JOIN LaPreDigital_DataMart_test.sys.columns AS pc ON pc.object_id = fk.parent_object_id AND pc.column_id = fk.parent_column_id
INNER JOIN LaPreDigital_DataMart_test.sys.columns AS rc ON rc.object_id = fk.referenced_object_id AND rc.column_id = fk.referenced_column_id`,
        )
      ).recordset;
      assert.equal(relations.length, 32);
      assert.ok(
        relations.every(
          (relation) => relation.origen.startsWith('Key') && relation.destino.startsWith('Key'),
        ),
      );
      const planKeys = (await query(db, `SELECT KeyPlan, idPlan FROM ${martTable('DimPlan')}`))
        .recordset;
      assert.ok(planKeys.every((plan) => plan.KeyPlan > 1000 && plan.KeyPlan !== plan.idPlan));
      const dimensionSnapshot = async () => {
        const result = {};
        for (const table of dimensionTables)
          result[table] = (
            await query(db, `SELECT * FROM ${martTable(table)} ORDER BY 1`)
          ).recordset;
        return result;
      };
      const keysBefore = await dimensionSnapshot();
      const result = async (code) =>
        getKpis({ ...filters, contactId: seeded.scenarios[code].contact }, { now });
      const kpi = (data, id) => data.kpis.find((item) => item.id === id);
      const first = await result('I01');
      assert.equal(first.source, 'LaPreDigital_DataMart_test');
      assert.deepEqual(
        first.options.channels.map((channel) => channel.id),
        [0, 1, 2, 3],
      );
      assert.equal(kpi(first, 'L-2.1').denominator, 1, 'Dos preguntas no duplican el contacto-mes');
      assert.equal(kpi(first, 'L-2.1').numerator, 1);
      assert.equal(kpi(first, 'L-5.1').numerator, 1);
      const raw = (await repository.listProposals(db)).filter(
        (row) => row.idCaso === seeded.scenarios.I01.caseId,
      );
      assert.equal(raw.length, 2);
      const proposal = computeKpi(
        KPI_DEFINITIONS.find((item) => item.id === 'L-4.1'),
        proposalRows(raw, now),
        filters,
        now,
      );
      assert.equal(proposal.denominator, 1, 'Dos planes no duplican el caso-mes');
      assert.equal(proposal.numerator, 1);
      assert.deepEqual(
        proposal.breakdown.plan.map((item) => item.numerator),
        [0, 1],
      );
      const second = await result('I02');
      assert.equal(kpi(second, 'L-1.2').numerator, 0, 'Una respuesta fuera de 168 horas no cuenta');
      assert.equal(kpi(second, 'L-2.1').denominator, 1);
      assert.equal(kpi(second, 'L-2.1').numerator, 0);
      assert.equal(kpi(await result('I03'), 'L-3.1').numerator, 1);
      const fourth = await result('I04');
      assert.equal(kpi(fourth, 'L-3.1').denominator, 1, 'Necesidad pendiente no abre otra cohorte');
      assert.equal(
        kpi(fourth, 'L-3.1').numerator,
        0,
        'Exige coincidencia temporal de ambas autorizaciones',
      );
      const fifth = await result('I05');
      assert.equal(kpi(fifth, 'L-5.1').denominator, 0, 'La beca completa se excluye de M10');
      assert.match(kpi(fifth, 'L-5.1').note, /1 caso/);
      assert.equal(
        kpi(await result('I06'), 'L-5.1').numerator,
        0,
        'Reembolso invalidante dentro de ventana',
      );
      assert.equal(
        kpi(await result('I07'), 'L-5.1').numerator,
        0,
        'Validación un segundo después de 168 horas',
      );
      assert.equal(kpi(await result('I08'), 'L-1.1').denominator, 1);
      assert.equal(kpi(await result('I08'), 'L-1.1').numerator, 0);
      await query(
        db,
        `UPDATE h SET M5 = 0 FROM ${martTable('HechoAmpliacionPerfil')} AS h
INNER JOIN ${martTable('DimContacto')} AS c ON c.KeyContacto = h.KeyContacto
WHERE c.idContacto = @id`,
        { id: seeded.scenarios.I01.contact },
      );
      assert.equal(
        kpi(await result('I01'), 'L-2.1').numerator,
        0,
        'La API usa hechos cargados, sin recalcular desde OLTP',
      );
      await refreshDataMart();
      assert.deepEqual(
        await dimensionSnapshot(),
        keysBefore,
        'Repetir el ETL conserva las keys y no duplica dimensiones',
      );
      assert.equal(
        kpi(await result('I01'), 'L-2.1').numerator,
        1,
        'La recarga recupera el resultado desde la evidencia OLTP',
      );
    });
  } finally {
    await close();
  }
});

test('un logro temprano conserva el resultado provisional hasta cerrar su ventana', () => {
  const definition = KPI_DEFINITIONS.find((item) => item.id === 'L-4.1');
  const records = [
    {
      idPropuesta: 1,
      idCaso: 1,
      idCanal: 2,
      idPlan: 1,
      fechaEntrega: '2026-11-12T10:00:00',
      fechaAceptacionExpresa: '2026-11-12T11:00:00',
      M8: 1,
      M9: 1,
    },
  ];
  const result = computeKpi(definition, proposalRows(records, now), filters, now);
  assert.equal(result.numerator, 1);
  assert.equal(result.provisional, 1);
});
