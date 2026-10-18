// The route table: every /api route, declared once, grouped by what it is for.
// functions/api/[[route]].js dispatches through it; the /api manifest and the
// golden contract test read it too.
import { createRouter } from '../_kernel/router.js';
import { internalError, notFound, preflight } from '../_kernel/http.js';
import { agentManifest as buildAgentManifest, routeCatalogue } from './protocol/agent-manifest.js';
import protocol from './protocol/routes.js';
import participate from './participate/routes.js';
import reference from './reference/routes.js';
import collection from './collection/routes.js';
import museum from './museum/routes.js';
import rooms from './rooms/routes.js';
import search from './search/routes.js';
import generate from './generate/routes.js';
import play from './play/routes.js';
import lore from './lore/routes.js';
import pipeline from './pipeline/routes.js';

export const DOMAINS = { protocol, participate, reference, collection, museum, rooms, search, generate, play, lore, pipeline };

export const router = createRouter(Object.values(DOMAINS).flat());

// The manifest /api serves, and its category view, built from the same table.
export const agentManifest = () => buildAgentManifest(router.routes);
export const ROUTES = routeCatalogue(router.routes);

// Every answer names the route that gave it, so a log line or a bug report
// can point at one declaration.
function stamp(response, routeId) {
  const out = new Response(response.body, response);
  out.headers.set('X-Artbitrage-Route', routeId);
  return out;
}

export async function handle(context, method = context.request.method) {
  const url = new URL(context.request.url);
  const found = router.find(method, url.pathname);
  if (!found) return stamp(method === 'OPTIONS' ? preflight(200) : notFound(url.pathname), method === 'OPTIONS' ? 'preflight' : 'not-found');
  const { route, params } = found;
  try {
    const response = await route.handler({
      ...context,
      url,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      params,
      routes: router.routes,
    });
    return stamp(response, route.id);
  } catch (error) {
    console.error(`artbitrage route ${route.id} failed:`, error?.stack || error);
    return stamp(internalError(route.id), route.id);
  }
}
