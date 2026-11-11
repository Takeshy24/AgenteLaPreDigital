import { pool, query } from './db.mjs';
import { reviewFollowup, reviewMaintenance } from './followup/service.mjs';
import { integrationConfig } from './integrations/config.mjs';
import { dispatchPending } from './integrations/dispatch.mjs';
import { recoverDispatches } from './integrations/repository.mjs';
import { telegramClient } from './integrations/telegram-client.mjs';
import { pollTelegram } from './integrations/telegram.mjs';
import { whatsappClient } from './integrations/whatsapp-client.mjs';
import { pollWhatsApp } from './integrations/whatsapp.mjs';
export async function startWorkers() {
  const config = integrationConfig();
  const enabled = config.telegram.enabled && !!config.telegram.token;
  let timer,
    running,
    lastReview = 0,
    stopped = false;
  const abort = new AbortController();
  const whatsappEnabled =
    config.whatsapp.enabled && !!config.whatsapp.token && !!config.whatsapp.phoneNumberId;
  if (!enabled && !whatsappEnabled && !config.followup.enabled) return async () => {};
  const db = await pool();
  const lease = (
    await query(
      db,
      `DECLARE @result INT;

EXEC @result = sys.sp_getapplock @Resource = N'LaPreDigitalWorkers',
@LockMode = N'Exclusive',
@LockOwner = N'Session',
@LockTimeout = 0;

SELECT
  @result result;`,
    )
  ).recordset[0].result;
  if (lease < 0) throw new Error('Ya existe un proceso de integraciones en ejecución.');
  await recoverDispatches(db);
  const baseClient = enabled ? telegramClient(config.telegram.token) : null;
  const client = baseClient
    ? {
        call: (method, data, options) => {
          if (abort.signal.aborted) throw new Error('Integraciones detenidas');
          return baseClient.call(method, data, options);
        },
      }
    : null;
  const whatsapp = whatsappEnabled
    ? (() => {
        const base = whatsappClient(config.whatsapp);
        return {
          send: (payload, options) => {
            if (abort.signal.aborted) throw new Error('Integraciones detenidas');
            return base.send(payload, options);
          },
          sendText: (to, text) => {
            if (abort.signal.aborted) throw new Error('Integraciones detenidas');
            return base.sendText(to, text);
          },
        };
      })()
    : null;
  async function tick() {
    if (stopped) return;
    running = (async () => {
      try {
        if (client) await pollTelegram(client);
        if (whatsapp) await pollWhatsApp(whatsapp);
        if (Date.now() - lastReview >= config.followup.interval) {
          if (config.followup.enabled)
            await reviewFollowup({
              canSend: (channel) =>
                (enabled && channel === 3) || (whatsappEnabled && channel === 1),
            });
          else await reviewMaintenance();
          lastReview = Date.now();
        }
        if (client || whatsapp) await dispatchPending(client, { whatsapp });
      } catch (error) {
        if (!stopped) console.error('Integraciones:', error.message);
      }
    })();
    await running;
    if (!stopped) timer = setTimeout(tick, 1000);
  }
  tick();
  return async () => {
    stopped = true;
    abort.abort();
    clearTimeout(timer);
    await running;
  };
}
