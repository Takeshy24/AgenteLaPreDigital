import { z } from 'zod';
import { id, route } from '../http/validation.mjs';
import * as service from './service.mjs';
import { registerInquiry } from './intake.mjs';
import { activateTrial, viewTrial } from '../trials/service.mjs';
import { completeOnboarding } from '../onboarding/service.mjs';
import { viewInvitation, acceptPublicInvitation } from './invitations.mjs';

const token = z.string().regex(/^[A-Za-z0-9_-]{40,100}$/);
const trialToken = z.string().regex(/^[A-Za-z0-9_-]{32}$/);
const inquiry = z
  .object({
    name: z.string().trim().min(2).max(150),
    email: z.email().max(254),
    phone: z.string().regex(/^\+[0-9 ]{7,19}$/),
    role: z.number().int().min(1).max(4),
    beneficiary: z.string().trim().max(150),
    beneficiaryId: id.optional(),
    isStudent: z.boolean(),
    plan: z.string().trim().min(2).max(80),
    consent: z.literal(true),
    tariff: z.number().int().positive().optional(),
    requestKey: z.string().uuid().optional(),
  })
  .strict()
  .refine((data) => data.isStudent === (data.role === 1), {
    message: 'Rol y beneficiario incoherentes.',
  });
export function registerRoutes(app) {
  app.get('/api/public/invitations/:code', async (req, res, next) => {
    try {
      res.json(await viewInvitation(z.uuid().parse(req.params.code)));
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/public/invitations/:code', async (req, res, next) => {
    try {
      const data = z
        .object({
          name: z.string().trim().min(2).max(150),
          email: z.email().max(254),
          phone: z.string().regex(/^\+[0-9 ]{7,19}$/),
          contactConsent: z.literal(true),
          linkConsent: z.literal(true),
        })
        .strict()
        .parse(req.body);
      res.json(await acceptPublicInvitation(z.uuid().parse(req.params.code), data));
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/public/plans', route(null, service.listPlans));
  app.get('/api/public/trials/:token', async (req, res, next) => {
    try {
      res.json(await viewTrial(trialToken.parse(req.params.token)));
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/public/trials/:token', async (req, res, next) => {
    try {
      z.object({ activate: z.literal(true) })
        .strict()
        .parse(req.body);
      res.json(await activateTrial(trialToken.parse(req.params.token)));
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/public-inquiries', route(null, service.getInquiries));
  app.post(
    '/api/onboarding/:id/complete',
    route(inquiry, (data, id) => completeOnboarding(id, data)),
  );
  app.post(
    '/api/public-inquiries/:id/complete',
    route(inquiry, (data, id) => registerInquiry(data, { operator: true, inquiryId: id })),
  );
  app.post(
    '/api/public/interest',
    route(
      inquiry.refine((data) => data.beneficiaryId === undefined, {
        message: 'La identidad existente requiere revisión del operador.',
      }),
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
