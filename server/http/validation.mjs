import { z } from 'zod';
export const id = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const channel = z.number().int().min(1).max(3);
export const route = (schema, handler) => async (req, res, next) => {
  try {
    res.json(
      await handler(
        schema ? schema.parse(req.body) : undefined,
        req.params.id ? id.parse(req.params.id) : undefined,
      ),
    );
  } catch (error) {
    next(error);
  }
};
