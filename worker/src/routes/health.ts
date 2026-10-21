import { json } from '../http';
import type { Route } from '../router';

export const healthRoute: Route = {
  method: 'GET',
  path: '/health',
  public: true,
  handler: async () => json(200, { ok: true }),
};
