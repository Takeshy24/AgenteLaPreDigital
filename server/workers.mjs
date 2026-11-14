import { pool, query } from './db.mjs';
import { reviewFollowup, reviewMaintenance } from './followup/service.mjs';
import { integrationConfig } from './integrations/config.mjs';
import { dispatchPending } from './integrations/dispatch.mjs';
import { insideServiceWindow, recoverDispatches } from './integrations/repository.mjs';
import { welcomeApproved } from './integrations/welcome-approval.mjs';
import { telegramClient } from './integrations/telegram-client.mjs';
import { pollTelegram } from './integrations/telegram.mjs';
import { whatsappClient } from './integrations/whatsapp-client.mjs';
import { pollWhatsApp } from './integrations/whatsapp.mjs';
import { sendEmail } from './integrations/mailer.mjs';

export async function runWorkerCycle({ telegram, whatsapp, maintenance, dispatch, reportError }) {
  for (const [name, task] of [
    ['Telegram', telegram],
    ['WhatsApp', whatsapp],
    ['mantenimiento', maintenance],
    ['envíos', dispatch],
  ]) {
    if (!task) continue;
    try {
      await task();
    } catch (error) {
      reportError(name, error);
    }
  }
}

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
  const mail = config.smtp.user && config.smtp.password ? { send: sendEmail } : null;
  if (!enabled && !whatsappEnabled && !config.followup.enabled && !mail) return async () => {};
  // Canales que pueden enviar un intento ahora. WhatsApp no deja escribir primero sin una plantilla
  // aprobada para ese texto, así que solo se usa dentro de las 24 horas desde el último mensaje del
  // contacto; fuera de ellas el intento pasa al siguiente canal autorizado (correo o Telegram).
  const canSendNow = async (channel, contact, tx) =>
    (enabled && channel === 3) ||
    (!!mail && channel === 2) ||
    (whatsappEnabled && channel === 1 && (await insideServiceWindow(tx, contact)));
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
    const reviewDue = Date.now() - lastReview >= config.followup.interval;
    running = runWorkerCycle({
      telegram: client ? () => pollTelegram(client) : null,
      whatsapp: whatsapp ? () => pollWhatsApp(whatsapp) : null,
      maintenance: reviewDue
        ? async () => {
            lastReview = Date.now();
            if (config.followup.enabled)
              await reviewFollowup({
                canSend: (channel, contact, tx) => canSendNow(channel, contact, tx),
                welcomeReady: whatsappEnabled ? await welcomeApproved(config.whatsapp) : false,
              });
            else await reviewMaintenance();
          }
        : null,
      dispatch:
        client || whatsapp || mail ? () => dispatchPending(client, { whatsapp, mail }) : null,
      reportError: (name, error) => {
        if (!stopped) console.error(`Integraciones (${name}):`, error.message);
      },
    });
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
