import { z } from 'zod';
import { channel, route } from '../http/validation.mjs';
import { recordIncoming } from './service.mjs';
export function registerRoutes(app) {
  app.post(
    '/api/participations/:id/messages/incoming',
    route(
      z
        .object({
          text: z.string().trim().min(1).max(8000),
          channel,
          level: z.number().int().min(1).max(3),
          retraction: z.boolean().optional(),
        })
        .strict(),
      (body, id) => recordIncoming(id, body),
    ),
  );
}
