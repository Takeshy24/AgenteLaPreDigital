import { close } from '../server/db.mjs';
import {
  dataMartConfig,
  initializeDataMart,
  refreshDataMart,
} from '../server/datamart/service.mjs';

try {
  const command = process.argv[2];
  if (!['init', 'refresh'].includes(command))
    throw new Error('Uso: node tools/datamart.mjs init | refresh [--check]');
  if (process.argv.includes('--check')) {
    console.log({ accion: command, ...dataMartConfig() });
  } else {
    const result = await (command === 'init' ? initializeDataMart() : refreshDataMart());
    console.log(`DataMart cargado: ${result.database}`);
    console.table(result.counts);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await close();
}
