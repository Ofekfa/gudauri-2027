/**
 * Gudauri 2027 Worker: AI assistant proxy (and, from Round 2, cached data routes).
 * Holds no API keys for the AI: it calls Workers AI through the `AI` binding.
 * Every route goes through the shared pipeline in router.ts.
 */
import type { Env } from './env';
import { createRouter } from './router';
import { chatRoute } from './routes/chat';
import { healthRoute } from './routes/health';
import { itineraryRoute } from './routes/itinerary';
import { ratesRoute } from './routes/rates';
import { weatherRoute } from './routes/weather';

export type { Env } from './env';
export { parseMessages } from './routes/chat';

export const handleRequest = createRouter([
  healthRoute,
  chatRoute,
  ratesRoute,
  itineraryRoute,
  weatherRoute,
]);

export default {
  fetch: (request: Request, env: Env) => handleRequest(request, env),
} satisfies ExportedHandler<Env>;
