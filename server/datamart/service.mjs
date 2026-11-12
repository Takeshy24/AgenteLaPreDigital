import { readFileSync } from 'node:fs';
import { pool, query, transaction } from '../db.mjs';
import { BusinessError } from '../shared/errors.mjs';

const tables = [
  'DimTiempo',
  'DimContacto',
  'DimCanal',
  'DimRolContacto',
  'DimPlan',
  'DimPrioridad',
  'HechoContactoInicial',
  'HechoAmpliacionPerfil',
  'HechoVinculacionEconomica',
  'HechoPropuestaComercial',
  'HechoConversionPagada',
];
const identifier = (value) => {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) throw new Error('Nombre de base de datos inválido.');
  return `[${value}]`;
};
export function dataMartConfig() {
  const source = process.env.DB_DATABASE || 'LaPreDigital_OLTP';
  const database =
    process.env.DATAMART_DATABASE ||
    (source.endsWith('_test') ? 'LaPreDigital_DataMart_test' : 'LaPreDigital_DataMart');
  identifier(source);
  identifier(database);
  if (source === database) throw new Error('El OLTP y el DataMart deben ser bases diferentes.');
  return { source, database };
}
export function martTable(name) {
  if (!tables.includes(name)) throw new Error('Tabla dimensional desconocida.');
  return `${identifier(dataMartConfig().database)}.dbo.${name}`;
}
const batches = (file) =>
  readFileSync(new URL(`../../sql/${file}`, import.meta.url), 'utf8')
    .split(/^\s*GO\s*$/gim)
    .map((batch) => batch.trim())
    .filter(Boolean);
function render(batch) {
  const { source, database } = dataMartConfig();
  return batch
    .replaceAll('LaPreDigital_DataMart', identifier(database))
    .replaceAll('LaPreDigital_OLTP', identifier(source));
}
async function executeBatch(db, batch) {
  const { database } = dataMartConfig();
  return query(db, `EXEC ${identifier(database)}.sys.sp_executesql @stmt = @sql`, {
    sql: render(batch),
  });
}
async function lock(db, mode) {
  await query(
    db,
    `
DECLARE @result INT;
EXEC @result = sys.sp_getapplock
    @Resource = @resource, @LockMode = @mode,
    @LockOwner = N'Transaction', @LockTimeout = 10000;
IF @result < 0 THROW 51000, N'El DataMart está ocupado. Vuelve a intentarlo.', 1;`,
    { resource: `LaPreDigital:DataMart:${dataMartConfig().database}`, mode },
  );
}
async function ready(db) {
  const { database } = dataMartConfig();
  const found = (await query(db, 'SELECT DB_ID(@database) AS id', { database })).recordset[0].id;
  if (found == null)
    throw new BusinessError('El DataMart no está preparado. Ejecuta npm run datamart:init.', 503);
  const columns = (
    await query(
      db,
      `SELECT t.name AS tableName, c.name AS columnName, c.is_identity AS isIdentity
FROM ${identifier(database)}.sys.tables AS t
INNER JOIN ${identifier(database)}.sys.columns AS c ON c.object_id = t.object_id
WHERE t.schema_id = 1`,
    )
  ).recordset;
  if (tables.some((name) => !columns.some((column) => column.tableName === name))) {
    throw new BusinessError('Faltan tablas del DataMart. Ejecuta npm run datamart:init.', 503);
  }
  const dimensionKeys = {
    DimTiempo: 'KeyTiempo',
    DimContacto: 'KeyContacto',
    DimCanal: 'KeyCanal',
    DimRolContacto: 'KeyRolContacto',
    DimPlan: 'KeyPlan',
    DimPrioridad: 'KeyPrioridad',
  };
  const invalidDimension = Object.entries(dimensionKeys).some(
    ([table, key]) =>
      !columns.some(
        (column) => column.tableName === table && column.columnName === key && column.isIdentity,
      ),
  );
  const invalidFact = columns.some(
    (column) =>
      tables.includes(column.tableName) &&
      column.tableName.startsWith('Hecho') &&
      !/^(Key\w+|M(?:[1-9]|10|11))$/.test(column.columnName),
  );
  if (invalidDimension || invalidFact) {
    throw new BusinessError(
      'El DataMart utiliza el modelo anterior. Ejecuta npm run datamart:rebuild.',
      503,
    );
  }
}
async function load(db) {
  for (const file of ['etl_dimensiones.sql', 'etl_hechos.sql']) {
    for (const batch of batches(file)) {
      if (!/^USE\s/i.test(batch)) await executeBatch(db, batch);
    }
  }
  const counts = {};
  for (const name of tables) {
    counts[name] = (
      await query(db, `SELECT COUNT(*) AS cantidad FROM ${martTable(name)}`)
    ).recordset[0].cantidad;
  }
  return { database: dataMartConfig().database, counts };
}
export async function readDataMart(work) {
  return transaction(async (db) => {
    await lock(db, 'Shared');
    await ready(db);
    return work(db);
  });
}
export async function refreshDataMart() {
  return transaction(async (db) => {
    await lock(db, 'Exclusive');
    await ready(db);
    return load(db);
  });
}
export async function initializeDataMart({ rebuild = false } = {}) {
  const db = await pool();
  const { database } = dataMartConfig();
  const found = (await query(db, 'SELECT DB_ID(@database) AS id', { database })).recordset[0].id;
  if (found == null) await query(db, `CREATE DATABASE ${identifier(database)}`);
  return transaction(async (connection) => {
    await lock(connection, 'Exclusive');
    if (rebuild) {
      for (const batch of batches('reiniciar_datamart.sql')) {
        if (!/^USE\s/i.test(batch)) await executeBatch(connection, batch);
      }
    }
    for (const file of ['dimensiones.sql', 'hechos.sql']) {
      for (const batch of batches(file)) {
        const name = batch.match(/^CREATE TABLE dbo\.(\w+)/)?.[1];
        if (!name) continue;
        const exists = (
          await query(connection, "SELECT OBJECT_ID(@name, N'U') AS id", {
            name: `${database}.dbo.${name}`,
          })
        ).recordset[0].id;
        if (exists == null) await executeBatch(connection, batch);
      }
    }
    await ready(connection);
    return load(connection);
  });
}
