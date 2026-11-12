import { close } from '../server/db.mjs';
import {
  dataMartConfig,
  initializeDataMart,
  refreshDataMart,
} from '../server/datamart/service.mjs';

try {
  const command = process.argv[2];
  if (!['init', 'refresh', 'rebuild'].includes(command))
    throw new Error('Uso: node tools/datamart.mjs init | refresh | rebuild [--check]');
  if (process.argv.includes('--check')) {
    console.log({ accion: command, ...dataMartConfig() });
  } else {
    const result =
      command === 'refresh'
        ? await refreshDataMart()
        : await initializeDataMart({ rebuild: command === 'rebuild' });
    console.log(`DataMart cargado: ${result.database}`);
    console.table(result.counts);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await close();
}
