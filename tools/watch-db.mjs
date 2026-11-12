import 'dotenv/config';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { close, pool, query } from '../server/db.mjs';

const eventTable = 'dbo.App_DbWatchEvent';
const triggerPrefix = 'trg_App_DbWatch_';
const lockName = 'LaPreDigital.DbWatch';
const quoteName = (value) => `[${value.replaceAll(']', ']]')}]`;
const quoteText = (value) => `N'${value.replaceAll("'", "''")}'`;

export const createEventTable = `
  IF OBJECT_ID(N'${eventTable}', N'U') IS NULL
  CREATE TABLE ${eventTable} (
    id bigint IDENTITY(1, 1) PRIMARY KEY,
    occurredAt datetimeoffset(3) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    tableName nvarchar(517) NOT NULL,
    operation varchar(6) NOT NULL,
    rowKey nvarchar(max) NULL,
    loginName nvarchar(128) NULL
  );
`;

export async function acquireWatchLock(db) {
  const result = await query(
    db,
    `
      DECLARE @result int;
      EXEC @result = sys.sp_getapplock
        @Resource = @resource, @LockMode = 'Exclusive',
        @LockOwner = 'Session', @LockTimeout = 0;
      SELECT @result AS result;
    `,
    { resource: lockName },
  );
  if (result.recordset[0].result < 0) {
    throw new Error('Ya hay otro monitor conectado a esta base. Cierra esa terminal primero.');
  }
}

export async function listWatchTables(db) {
  const { recordset } = await query(
    db,
    `
      SELECT t.object_id AS tableId, s.name AS schemaName, t.name AS tableName,
             c.name AS keyName
      FROM sys.tables t
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      LEFT JOIN sys.indexes i ON i.object_id = t.object_id AND i.is_primary_key = 1
      LEFT JOIN sys.index_columns ic
        ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal > 0
      LEFT JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE t.is_ms_shipped = 0
        AND t.object_id <> ISNULL(OBJECT_ID(N'${eventTable}', N'U'), -1)
      ORDER BY s.name, t.name, ic.key_ordinal;
    `,
  );
  const tables = new Map();
  for (const row of recordset) {
    if (!tables.has(row.tableId)) tables.set(row.tableId, { ...row, keys: [] });
    if (row.keyName) tables.get(row.tableId).keys.push(row.keyName);
  }
  return [...tables.values()];
}

export function buildWatchTrigger(table) {
  const name = `${quoteName(table.schemaName)}.${quoteName(`${triggerPrefix}${table.tableId}`)}`;
  const target = `${quoteName(table.schemaName)}.${quoteName(table.tableName)}`;
  const key = table.keys.length
    ? `(SELECT ${table.keys.map((column) => `r.${quoteName(column)}`).join(', ')}
        FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER)`
    : 'NULL';
  return `
    CREATE OR ALTER TRIGGER ${name} ON ${target}
    AFTER INSERT, UPDATE, DELETE
    AS
    BEGIN
      SET NOCOUNT ON;
      -- Al cerrarse la conexión del monitor, el bloqueo desaparece y deja de registrar.
      IF APPLOCK_TEST(N'public', N'${lockName}', N'Shared', N'Session') = 1 RETURN;

      IF EXISTS (SELECT 1 FROM inserted)
      BEGIN
        DECLARE @operation varchar(6) =
          CASE WHEN EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE' ELSE 'INSERT' END;
        INSERT INTO ${eventTable} (tableName, operation, rowKey, loginName)
        SELECT ${quoteText(target)}, @operation, ${key}, ORIGINAL_LOGIN()
        FROM inserted r;
      END
      ELSE
      BEGIN
        INSERT INTO ${eventTable} (tableName, operation, rowKey, loginName)
        SELECT ${quoteText(target)}, 'DELETE', ${key}, ORIGINAL_LOGIN()
        FROM deleted r;
      END;
    END;
  `;
}

export async function installWatch(db, tables) {
  await db.execute({ action: 'begin' });
  try {
    await query(db, createEventTable);
    for (const table of tables) await query(db, buildWatchTrigger(table));
    await db.execute({ action: 'commit' });
  } catch (error) {
    await db.execute({ action: 'rollback' });
    throw error;
  }
}

export async function removeWatch(db) {
  await db.execute({ action: 'begin' });
  try {
    const { recordset } = await query(
      db,
      `
        SELECT s.name AS schemaName, tr.name AS triggerName
        FROM sys.triggers tr
        JOIN sys.tables t ON t.object_id = tr.parent_id
        JOIN sys.schemas s ON s.schema_id = t.schema_id
        WHERE tr.name = N'${triggerPrefix}' + CONVERT(nvarchar(20), t.object_id);
      `,
    );
    for (const trigger of recordset) {
      await query(
        db,
        `DROP TRIGGER ${quoteName(trigger.schemaName)}.${quoteName(trigger.triggerName)};`,
      );
    }
    await query(db, `DROP TABLE IF EXISTS ${eventTable};`);
    await db.execute({ action: 'commit' });
  } catch (error) {
    await db.execute({ action: 'rollback' });
    throw error;
  }
}

export async function readWatchEvents(db) {
  // Consumir la cola evita perder transacciones que confirman fuera del orden de IDENTITY.
  const { recordset } = await query(
    db,
    `
      WITH pending AS (
        SELECT TOP (200) *
        FROM ${eventTable} WITH (READPAST, READCOMMITTEDLOCK)
        ORDER BY id
      )
      DELETE FROM pending
      OUTPUT CONVERT(varchar(20), deleted.id) AS id,
             CONVERT(varchar(40), deleted.occurredAt, 127) AS occurredAt,
             deleted.tableName, deleted.operation, deleted.rowKey, deleted.loginName;
    `,
  );
  return recordset.sort((left, right) => (BigInt(left.id) < BigInt(right.id) ? -1 : 1));
}

const actions = { INSERT: 'CREADO', UPDATE: 'EDITADO', DELETE: 'ELIMINADO' };
const clock = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'America/Lima',
});

export function printWatchEvent(event) {
  const time = clock.format(new Date(event.occurredAt));
  const key = event.rowKey || '(sin clave primaria)';
  console.log(
    `[${time}] ${actions[event.operation]} | ${event.tableName} | clave=${key} | usuario=${JSON.stringify(event.loginName)}`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Uso: npm run db:watch [-- --check | --uninstall]');
    console.log('--check: comprueba conexión y tablas, sin modificar la base.');
    console.log('--uninstall: retira objetos de un monitor interrumpido.');
    return;
  }
  if (args.some((arg) => !['--check', '--uninstall'].includes(arg)) || args.length > 1) {
    throw new Error('Argumentos inválidos. Consulta npm run db:watch -- --help.');
  }

  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  let installed = false;
  let db;
  try {
    db = await pool();
    const target = (
      await query(db, 'SELECT @@SERVERNAME AS serverName, DB_NAME() AS databaseName;')
    ).recordset[0];
    console.log(`Base: ${target.databaseName} | servidor: ${target.serverName}`);
    if (args.includes('--uninstall')) {
      await acquireWatchLock(db);
      await removeWatch(db);
      console.log('Objetos de monitoreo retirados.');
      return;
    }
    const tables = await listWatchTables(db);
    if (args.includes('--check')) {
      console.log(
        `Conexión correcta. ${tables.length} tablas disponibles. No se modificó la base.`,
      );
      return;
    }
    await acquireWatchLock(db);
    await installWatch(db, tables);
    installed = true;
    console.log(`Monitoreando ${tables.length} tablas cada segundo. Horario: Lima (UTC-5).`);
    console.log('INSERT = CREADO | UPDATE = EDITADO | DELETE = ELIMINADO. Ctrl+C para detener.');
    console.log('Solo cambios confirmados; no incluye TRUNCATE ni cargas sin FIRE_TRIGGERS.');
    console.log('Las tablas creadas después requieren reiniciar el monitor.');

    while (!controller.signal.aborted) {
      const events = await readWatchEvents(db);
      for (const event of events) printWatchEvent(event);
      if (events.length === 200) continue;
      try {
        await delay(1000, undefined, { signal: controller.signal });
      } catch (error) {
        if (error.name !== 'AbortError') throw error;
      }
    }
  } finally {
    try {
      if (installed) {
        await removeWatch(db);
        console.log('Monitor detenido; triggers y cola de monitoreo retirados.');
      }
    } finally {
      await close();
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`No se pudo ejecutar el monitor: ${error.message}`);
    process.exitCode = 1;
  });
}
