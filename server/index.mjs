import { app } from './app.mjs';
import { close } from './db.mjs';
import { startWorkers } from './workers.mjs';
const stopWorkers = await startWorkers();
const host = process.env.PUBLIC_ORIGIN ? process.env.BIND_HOST || '127.0.0.1' : '127.0.0.1';
const server = app.listen(Number(process.env.PORT || 3067), host, () =>
  console.log('API en ' + host + ':' + (process.env.PORT || 3067)),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(async () => {
      await stopWorkers();
      await close();
      process.exit(0);
    }),
  );
