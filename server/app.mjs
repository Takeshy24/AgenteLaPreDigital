import express from 'express';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { registerRoutes as consentsRoutes } from './consents/routes.mjs';
import { registerRoutes as contractsRoutes } from './contracts/routes.mjs';
import { handleStripeEvent, verifyStripeEvent } from './contracts/webhook.mjs';
import { integrationConfig } from './integrations/config.mjs';
import {
  receiveWebhook,
  verifyWebhookChallenge,
  verifyWhatsAppSignature,
} from './integrations/whatsapp.mjs';
import { registerRoutes as publicRoutes } from './public/routes.mjs';
import { registerRoutes as kpisRoutes } from './kpis/routes.mjs';
import { registerRoutes as leadsRoutes } from './leads/routes.mjs';
import { registerRoutes as messagesRoutes } from './messages/routes.mjs';
import { registerRoutes as operationsRoutes } from './operations/routes.mjs';
import { registerRoutes as prioritiesRoutes } from './priorities/routes.mjs';
import { registerRoutes as profilesRoutes } from './profiles/routes.mjs';
import { registerRoutes as proposalsRoutes } from './proposals/routes.mjs';
import { registerRoutes as pendingRoutes } from './pending/routes.mjs';
import { BusinessError } from './shared/errors.mjs';
import { registerRoutes as workspaceRoutes } from './workspace/routes.mjs';
import { registerRoutes as knowledgeRoutes } from './knowledge/routes.mjs';
import { registerRoutes as authRoutes, requireSession } from './auth/routes.mjs';
const app = express();
app.disable('x-powered-by');
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json', limit: '256kb' }),
  async (req, res) => {
    try {
      const event = verifyStripeEvent(
        req.body.toString('utf8'),
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET,
      );
      await handleStripeEvent(event);
      res.json({ received: true });
    } catch (error) {
      console.error('Stripe webhook:', error.message);
      res.status(400).json({ error: 'No se pudo verificar o registrar el evento.' });
    }
  },
);
app.get('/api/public/whatsapp/webhook', (req, res) => {
  const config = integrationConfig().whatsapp;
  const challenge = config.enabled ? verifyWebhookChallenge(req.query, config.verifyToken) : null;
  if (challenge === null) return res.sendStatus(403);
  res.type('text/plain').send(challenge);
});
app.post(
  '/api/public/whatsapp/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req, res) => {
    const config = integrationConfig().whatsapp;
    if (!config.enabled) return res.sendStatus(404);
    if (
      !Buffer.isBuffer(req.body) ||
      !verifyWhatsAppSignature(req.body, req.headers['x-hub-signature-256'], config.appSecret)
    )
      return res.sendStatus(403);
    try {
      await receiveWebhook(JSON.parse(req.body.toString('utf8')));
      res.sendStatus(200);
    } catch (error) {
      console.error('WhatsApp webhook:', error.message);
      res.sendStatus(500);
    }
  },
);
app.set('trust proxy', 'loopback');
function landingOrigins() {
  return (process.env.LANDING_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}
function allowCrossOrigin(res, origin) {
  res.set({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, ngrok-skip-browser-warning',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
}
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  const host = req.headers.host?.split(':')[0];
  const publicOrigin = process.env.PUBLIC_ORIGIN;
  const publicHost = publicOrigin ? new URL(publicOrigin).hostname : null;
  const fromLanding = !!origin && landingOrigins().includes(origin);
  if (
    req.path.startsWith('/public/') &&
    publicHost &&
    host === publicHost &&
    (!origin || origin === publicOrigin || fromLanding)
  ) {
    if (fromLanding) allowCrossOrigin(res, origin);
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host))
    return res.status(403).json({ error: 'Solo disponible en localhost' });
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
    return res.status(403).json({ error: 'Origen no autorizado' });
  if (!['GET', 'HEAD'].includes(req.method) && !req.is('application/json'))
    return res.status(415).json({ error: 'Se requiere application/json' });
  next();
});

app.use('/api/auth', express.json({ limit: '32kb' }));
authRoutes(app);
app.use('/api', requireSession);
app.use('/api/knowledge', express.json({ limit: '4mb' }));
app.use(express.json({ limit: '32kb' }));
workspaceRoutes(app);
knowledgeRoutes(app);
leadsRoutes(app);
kpisRoutes(app);
profilesRoutes(app);
messagesRoutes(app);
prioritiesRoutes(app);
proposalsRoutes(app);
pendingRoutes(app);
consentsRoutes(app);
operationsRoutes(app);
contractsRoutes(app);
publicRoutes(app);
app.use(express.static(fileURLToPath(new URL('../dist', import.meta.url))));
app.get(
  ['/landing', '/planes', '/oferta/:token', '/prueba/:token', '/invitacion/:code'],
  (req, res) => res.sendFile(fileURLToPath(new URL('../dist/index.html', import.meta.url))),
);
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((error, req, res, next) => {
  if (error instanceof z.ZodError)
    return res
      .status(400)
      .json({ error: error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') });
  if (error instanceof BusinessError)
    return res.status(error.status).json({ error: error.message });
  if (error?.type === 'entity.parse.failed')
    return res.status(400).json({ error: 'JSON inválido' });
  if (error?.type === 'entity.too.large')
    return res.status(413).json({ error: 'La solicitud excede el tamaño permitido.' });
  console.error('API:', error.message);
  res.status(500).json({
    error:
      'No se pudo guardar la operación. Se revirtieron los cambios; revisa el registro del servidor.',
  });
});
export { app };
