import { z } from 'zod';
import { id, route } from '../http/validation.mjs';
import * as service from './service.mjs';

const token = z.string().regex(/^[A-Za-z0-9_-]{40,100}$/);
export function registerRoutes(app) {
  app.get('/api/public/plans', route(null, service.listPlans));
  app.get('/api/public-inquiries', route(null, service.getInquiries));
  app.post(
    '/api/public/interest',
    route(
      z
        .object({
          name: z.string().trim().min(2).max(150),
          email: z.email().max(254),
          beneficiary: z.string().trim().min(2).max(150),
          isStudent: z.boolean(),
          plan: z.string().trim().min(2).max(80),
          consent: z.boolean(),
        })
        .strict(),
      service.requestPlan,
    ),
  );
  app.post(
    '/api/proposals/:id/public-link',
    route(z.object({}).strict(), (_, id) =>
      service.createOfferLink(
        id,
        process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3001}`,
      ),
    ),
  );
  app.get('/api/public/offers/:token', async (req, res, next) => {
    try {
      res.json(await service.viewOffer(token.parse(req.params.token)));
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/public/offers/:token/accept', async (req, res, next) => {
    try {
      res.json(await service.acceptOffer(token.parse(req.params.token)));
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/public/offers/:token/checkout', async (req, res, next) => {
    try {
      res.json(
        await service.payOffer(
          token.parse(req.params.token),
          process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3001}`,
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/public/offers/:token/confirm', async (req, res, next) => {
    try {
      res.json(
        await service.confirmOffer(
          token.parse(req.params.token),
          z
            .string()
            .regex(/^cs_test_[A-Za-z0-9_]+$/)
            .parse(req.body?.sessionId),
        ),
      );
    } catch (error) {
      next(error);
    }
  });
}
