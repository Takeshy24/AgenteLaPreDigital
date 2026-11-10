import { z } from 'zod';
import { id, route } from '../http/validation.mjs';
import * as service from './service.mjs';
const reference = z.string().trim().min(5).max(300);
export function registerRoutes(app) {
  app.post(
    '/api/cases/:id/stripe-checkout',
    route(z.object({}).strict(), (_, id) =>
      service.startStripeCheckout(id, `http://127.0.0.1:${process.env.PORT || 3001}`),
    ),
  );
  app.post(
    '/api/cases/:id/stripe-confirm',
    route(
      z.object({ sessionId: z.string().regex(/^cs_test_[A-Za-z0-9_]+$/) }).strict(),
      (body, id) => service.confirmStripeCheckout(id, body.sessionId),
    ),
  );
  app.post(
    '/api/cases/:id/terms',
    route(z.object({ proposalId: id, reference }).strict(), (body, id) =>
      service.acceptTerms(id, body),
    ),
  );
  app.post(
    '/api/cases/:id/payment-confirmation',
    route(
      z
        .object({
          reference,
          amount: z.number().positive().max(999999.99),
          confirmedExternally: z.literal(true),
        })
        .strict(),
      (body, id) => service.recordPayment(id, body),
    ),
  );
  app.post(
    '/api/cases/:id/validate',
    route(z.object({}).strict(), (_, id) => service.validateContract(id)),
  );
  app.post(
    '/api/cases/:id/activate',
    route(z.object({}).strict(), (_, id) => service.activateService(id)),
  );
  app.post(
    '/api/cases/:id/incident',
    route(
      z
        .object({ type: z.enum(['refund', 'partial-refund', 'dispute', 'resolution']), reference })
        .strict(),
      (body, id) => service.paymentIncident(id, body),
    ),
  );
  app.post(
    '/api/cases/:id/scholarship',
    route(
      z.object({ plan: z.number().int().min(1).max(3), endDate: z.iso.date(), reference }).strict(),
      (body, id) => service.authorizeScholarship(id, body),
    ),
  );
  app.post(
    '/api/cases/:id/scholarship/activate',
    route(z.object({}).strict(), (_, id) => service.activateScholarship(id)),
  );
}
