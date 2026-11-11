import { z } from 'zod';
import { channel, id, route } from '../http/validation.mjs';
import { prepareProposal, recordProposalResponse as proposalResponse } from './service.mjs';
export function registerRoutes(app) {
  app.post(
    '/api/participations/:id/proposals',
    route(
      z
        .object({
          tariff: id,
          replyTo: id,
          channel,
          justification: z.string().trim().min(5).max(500),
          price: z.number().positive().max(10000).optional(),
        })
        .strict(),
      (body, id) => prepareProposal(id, body),
    ),
  );
  app.post(
    '/api/proposals/:id/response',
    route(
      z.object({ messageId: id, result: z.number().int().min(1).max(2) }).strict(),
      (body, id) => proposalResponse(id, body),
    ),
  );
}
