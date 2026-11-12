import { z } from 'zod';
import { createKpiReport } from './report.mjs';
import { getKpis } from './service.mjs';
import { refreshDataMart } from '../datamart/service.mjs';

const date = z.iso.date();
const optionalNumber = (max) =>
  z.preprocess(
    (value) => (value === '' || value == null ? undefined : value),
    z.coerce.number().int().min(0).max(max).optional(),
  );
const filterSchema = z
  .object({
    from: z.preprocess((value) => value || undefined, date.optional()),
    to: z.preprocess((value) => value || undefined, date.optional()),
    grain: z.enum(['year', 'quarter', 'month', 'day']).default('month'),
    contact: optionalNumber(Number.MAX_SAFE_INTEGER),
    channel: optionalNumber(4),
    role: optionalNumber(4),
    plan: optionalNumber(255),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: 'La fecha inicial no puede ser posterior a la final.',
  });

function parseFilters(query) {
  const data = filterSchema.parse(query);
  return {
    from: data.from ?? null,
    to: data.to ?? null,
    grain: data.grain,
    contactId: data.contact ?? null,
    channel: data.channel ?? null,
    role: data.role ?? null,
    plan: data.plan ?? null,
  };
}

export function registerRoutes(app) {
  app.post('/api/kpis/refresh', async (req, res, next) => {
    try {
      res.json(await refreshDataMart());
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/kpis', async (req, res, next) => {
    try {
      res.json(await getKpis(parseFilters(req.query)));
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/kpis/report.pdf', async (req, res, next) => {
    try {
      const data = await getKpis(parseFilters(req.query));
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="indicadores-leads-${data.generatedAt.slice(0, 10)}.pdf"`,
      });
      createKpiReport(data).pipe(res);
    } catch (error) {
      next(error);
    }
  });
}
