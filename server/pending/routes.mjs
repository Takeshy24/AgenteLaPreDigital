import { route } from '../http/validation.mjs';
import { listPending } from './service.mjs';
export function registerRoutes(app) {
  app.get('/api/pending', route(null, listPending));
}
