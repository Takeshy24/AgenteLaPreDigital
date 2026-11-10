import { readFileSync, readdirSync } from 'node:fs';
import { transaction, query, close } from '../server/db.mjs';
try {
  for (const file of readdirSync(new URL('../script/migrations/', import.meta.url))
    .filter((file) => file.endsWith('.sql'))
    .sort()) {
    await transaction((db) =>
      query(db, readFileSync(new URL('../script/migrations/' + file, import.meta.url), 'utf8')),
    );
    console.log('Migración aplicada: ' + file);
  }
} finally {
  await close();
}
