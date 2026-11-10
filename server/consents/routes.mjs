import { z } from 'zod';
import { channel, route } from '../http/validation.mjs';
import { saveConsent as consent } from './service.mjs';
export function registerRoutes(app) {
  app.post(
    '/api/participations/:id/consent',
    route(
      z
        .object({ channel, granted: z.boolean(), version: z.string().trim().min(1).max(30) })
        .strict(),
      (body, id) => consent(id, body),
    ),
  );
}
