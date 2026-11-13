import { z } from 'zod';
import { withdraw } from '../cases/service.mjs';
import { reviewFollowup } from '../followup/service.mjs';
import { attendHandoff, openHandoff } from '../handoffs/service.mjs';
import { id, route } from '../http/validation.mjs';
import { analyze, createTelegramLink, getIntegrationStatus } from '../integrations/service.mjs';
import { acceptGuardian, inviteGuardian } from '../links/service.mjs';
import { confirmExternalDelivery } from '../messages/delivery.mjs';
import { activateTrial, offerTrial } from '../trials/service.mjs';
import {
  getRecommendationSettings,
  setRecommendationSettings,
  previewRecommendation,
} from '../agent/recommendations.mjs';
export function registerRoutes(app) {
  app.get('/api/agent/recommendations/settings', route(null, getRecommendationSettings));
  app.patch(
    '/api/agent/recommendations/settings',
    route(
      z.object({ enabled: z.boolean(), version: z.number().int().positive() }).strict(),
      setRecommendationSettings,
    ),
  );
  app.post(
    '/api/agent/recommendations/preview',
    route(
      z
        .object({
          career: z.string().trim().min(2).max(100),
          availability: z.string().trim().max(200).default('2 horas al día'),
          budget: z.number().min(0).max(9999999.99),
          simulation: z.boolean().default(false),
        })
        .strict(),
      previewRecommendation,
    ),
  );
  app.post(
    '/api/participations/:id/trial-link',
    route(z.object({}).strict(), (_, id) => offerTrial(id)),
  );
  app.post(
    '/api/trials/activate',
    route(z.object({ token: z.string().min(20).max(100) }).strict(), (body) =>
      activateTrial(body.token),
    ),
  );
  app.post(
    '/api/participations/:id/invitations',
    route(
      z
        .object({
          messageId: id,
          name: z.string().trim().min(2).max(150),
          phone: z.string().max(20).optional(),
          role: z.number().int().min(2).max(4),
        })
        .strict(),
      (body, id) => inviteGuardian(id, body),
    ),
  );
  app.post(
    '/api/invitations/accept',
    route(
      z
        .object({
          code: z.uuid(),
          name: z.string().trim().min(2).max(150),
          email: z.email(),
          phone: z.string().regex(/^\+\d{7,19}$/),
          channel: z.number().int().min(1).max(2),
          contactConsent: z.literal(true),
          linkConsent: z.literal(true),
        })
        .strict(),
      (body) => acceptGuardian(body.code, body),
    ),
  );
  app.post(
    '/api/messages/:id/external-delivery',
    route(
      z
        .object({
          reference: z.string().trim().min(5).max(250),
          confirmedExternally: z.literal(true),
        })
        .strict(),
      (body, id) => confirmExternalDelivery(id, body),
    ),
  );
  app.post(
    '/api/participations/:id/withdraw',
    route(
      z.object({ messageId: id, reason: z.string().trim().min(5).max(200) }).strict(),
      (body, id) => withdraw(id, body),
    ),
  );
  app.post(
    '/api/participations/:id/handoff',
    route(
      z.object({ reason: z.number().int().min(1).max(7), messageId: id.optional() }).strict(),
      (body, id) => openHandoff(id, body),
    ),
  );
  app.post(
    '/api/participations/:id/handoff/attend',
    route(z.object({}).strict(), (_, id) => attendHandoff(id)),
  );
  app.post(
    '/api/followup/run',
    route(z.object({}).strict(), () => reviewFollowup({ prepare: false })),
  );
  app.get('/api/integrations/status', route(null, getIntegrationStatus));
  app.post(
    '/api/participations/:id/telegram-link',
    route(z.object({}).strict(), (_, id) => createTelegramLink(id)),
  );
  app.post(
    '/api/participations/:id/agent/analyze',
    route(z.object({ text: z.string().trim().min(1).max(8000) }).strict(), (body, id) =>
      analyze(id, body),
    ),
  );
}
