import { z } from 'zod';
import { id, route } from '../http/validation.mjs';
import { saveEvaluation as evaluation } from './service.mjs';
export function registerRoutes(app) {
  app.post(
    '/api/participations/:id/evaluations',
    route(
      z.object({ level: z.number().int().min(1).max(3), messageId: id.optional() }).strict(),
      (body, id) => evaluation(id, body),
    ),
  );
}
