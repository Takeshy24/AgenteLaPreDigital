import assert from 'node:assert/strict';
import test from 'node:test';
import { close, pool, query, rollbackTest } from '../db.mjs';
import { resumeExpired } from '../handoffs/repository.mjs';
import {
  acquireWatchLock,
  buildWatchTrigger,
  createEventTable,
  listWatchTables,
  readWatchEvents,
} from '../../tools/watch-db.mjs';

test('monitor SQL: varias filas, claves compuestas, cambios de clave, MERGE y rollback', async () => {
  const tableName = `App_DbWatchProbe_${process.pid}`;
  try {
    const monitor = await pool();
    await acquireWatchLock(monitor);
    await rollbackTest(async (db) => {
      await query(db, createEventTable);
      await query(
        db,
        `
          CREATE TABLE dbo.[${tableName}] (
            id int NOT NULL, scope nvarchar(20) NOT NULL, value int NOT NULL,
            PRIMARY KEY (id, scope)
          );
        `,
      );
      const table = (await listWatchTables(db)).find((item) => item.tableName === tableName);
      assert.deepEqual(table.keys, ['id', 'scope']);
      await query(db, buildWatchTrigger(table));
      await query(
        db,
        `
          INSERT INTO dbo.[${tableName}] VALUES (1, N'a', 10), (2, N'b', 20);
          UPDATE dbo.[${tableName}] SET value = value + 1;
          UPDATE dbo.[${tableName}] SET scope = N'c' WHERE id = 1;
          DELETE FROM dbo.[${tableName}] WHERE id = 2;
          UPDATE dbo.[${tableName}] SET value = 0 WHERE id = -1;
        `,
      );
      const events = await readWatchEvents(db);
      assert.deepEqual(events.map((event) => event.operation).sort(), [
        'DELETE',
        'INSERT',
        'INSERT',
        'UPDATE',
        'UPDATE',
        'UPDATE',
      ]);
      assert.deepEqual(JSON.parse(events.at(-2).rowKey), { id: 1, scope: 'c' });
      assert.deepEqual(JSON.parse(events.at(-1).rowKey), { id: 2, scope: 'b' });
      assert.ok(events.every((event) => event.tableName === `[dbo].[${tableName}]`));
      assert.equal((await readWatchEvents(db)).length, 0);

      await query(db, `INSERT INTO dbo.[${tableName}] VALUES (2, N'b', 20);`);
      await readWatchEvents(db);
      await query(
        db,
        `
          MERGE dbo.[${tableName}] AS target
          USING (VALUES (1, N'c', 50), (3, N'd', 60)) AS source (id, scope, value)
            ON target.id = source.id AND target.scope = source.scope
          WHEN MATCHED THEN UPDATE SET value = source.value
          WHEN NOT MATCHED THEN INSERT (id, scope, value)
            VALUES (source.id, source.scope, source.value)
          WHEN NOT MATCHED BY SOURCE THEN DELETE;
        `,
      );
      assert.deepEqual((await readWatchEvents(db)).map((event) => event.operation).sort(), [
        'DELETE',
        'INSERT',
        'UPDATE',
      ]);

      await query(db, 'SAVE TRANSACTION probe;');
      await query(db, `INSERT INTO dbo.[${tableName}] VALUES (4, N'e', 40);`);
      await query(db, 'ROLLBACK TRANSACTION probe;');
      assert.equal((await readWatchEvents(db)).length, 0);

      const handoffs = (await listWatchTables(db)).find((item) => item.tableName === 'Derivacion');
      await query(db, buildWatchTrigger(handoffs));
      assert.ok(Array.isArray((await resumeExpired(db)).recordset));
      await readWatchEvents(db);

      await query(
        monitor,
        "EXEC sys.sp_releaseapplock @Resource = N'LaPreDigital.DbWatch', @LockOwner = 'Session';",
      );
      await query(db, `INSERT INTO dbo.[${tableName}] VALUES (5, N'f', 50);`);
      assert.equal((await readWatchEvents(db)).length, 0, 'sin monitor no se acumulan eventos');
    });
    const { recordset } = await query(
      monitor,
      "SELECT OBJECT_ID(@tableName, N'U') AS tableId, OBJECT_ID(N'dbo.App_DbWatchEvent', N'U') AS queueId;",
      { tableName: `dbo.${tableName}` },
    );
    assert.equal(recordset[0].tableId, null);
    assert.equal(recordset[0].queueId, null);
  } finally {
    await close();
  }
});
