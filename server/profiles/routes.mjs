import { z } from 'zod';
import { channel, route } from '../http/validation.mjs';
import { saveProfile as updateProfile } from './service.mjs';
export function registerRoutes(app) {
  app.patch(
    '/api/participations/:id/profile',
    route(
      z
        .object({
          fields: z
            .object({
              university: z.string().trim().min(1).max(100).optional(),
              career: z.string().trim().min(1).max(100).optional(),
              availability: z.string().trim().min(1).max(200).optional(),
              budget: z.number().nonnegative().max(9999999.99).optional(),
              score: z.number().nonnegative().max(9999.99).optional(),
              courses: z.array(z.string().trim().min(2).max(100)).min(1).max(10).optional(),
              applications: z.string().trim().min(2).max(200).optional(),
            })
            .strict(),
          channel,
        })
        .strict(),
      (body, id) => updateProfile(id, body),
    ),
  );
}
