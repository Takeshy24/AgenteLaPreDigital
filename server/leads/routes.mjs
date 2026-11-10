import { z } from 'zod';
import { channel, id, route } from '../http/validation.mjs';
import { createLead } from './service.mjs';
export function registerRoutes(app) {
  app.post(
    '/api/leads',
    route(
      z
        .object({
          name: z.string().trim().min(2).max(150),
          email: z.union([z.email().max(254), z.literal('')]).optional(),
          phone: z.union([z.string().regex(/^\+[0-9 ]{7,19}$/), z.literal('')]).optional(),
          role: z.number().int().min(1).max(4),
          channel: z.number().int().min(1).max(5),
          communicationChannel: channel,
          consent: z.boolean(),
          beneficiaryId: id.optional(),
          beneficiaryName: z.string().trim().max(150).optional(),
        })
        .strict()
        .refine((d) => d.email || d.phone, { message: 'Correo o teléfono requerido' })
        .refine((d) => d.role === 1 || d.beneficiaryId || d.beneficiaryName?.length >= 2, {
          message: 'Identifica al estudiante beneficiario',
        })
        .refine(
          (d) =>
            !d.consent ||
            (d.communicationChannel === 1
              ? !!d.phone
              : d.communicationChannel === 2
                ? !!d.email
                : false),
          {
            message:
              'El canal autorizado requiere datos de contacto; Telegram exige iniciar el bot.',
          },
        ),
      createLead,
    ),
  );
}
