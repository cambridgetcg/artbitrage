// The route table: every /api route, declared once, grouped by what it is for.
// functions/api/[[route]].js dispatches through it; the /api manifest and the
// golden contract test read it too.
import { createRouter } from '../_kernel/router.js';
import { notFound, preflight } from '../_kernel/http.js';
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

export async function handle(context, method = context.request.method) {
  const url = new URL(context.request.url);
  const found = router.find(method, url.pathname);
  if (!found) return method === 'OPTIONS' ? preflight(200) : notFound(url.pathname);
  return found.route.handler({
    ...context,
    url,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    params: found.params,
  });
}
