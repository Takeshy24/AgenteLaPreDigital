import { route } from '../http/validation.mjs';
import {
  getWorkspace as bootstrap,
  getDetails as details,
  getHealth,
  listBeneficiaries,
} from './repository.mjs';
export function registerRoutes(app) {
  app.get('/api/health', route(null, getHealth));
  app.get('/api/bootstrap', route(null, bootstrap));
  app.get(
    '/api/participations/:id',
    route(null, (_, id) => details(id)),
  );
  app.get('/api/beneficiaries', route(null, listBeneficiaries));
}
