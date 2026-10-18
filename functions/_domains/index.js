// The route table: every /api route, declared once, grouped by what it is for.
// functions/api/[[route]].js dispatches through it; the /api manifest and the
// golden contract test read it too.
import { createRouter } from '../_kernel/router.js';
import { ERROR_SCHEMA, internalError, json, notFound, preflight } from '../_kernel/http.js';
import { budgetedAI } from '../_kernel/budget.js';
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

// A route that runs Workers AI sees a counted binding. Its answer carries the
// day's count; when a run was refused, a route with no written fallback
// (ai: 'required') answers 429 instead of its own error.
function labelBudget(response, route, ledger) {
  const last = ledger[ledger.length - 1];
  if (!last) return response;
  const refused = ledger.find(decision => !decision.allowed);
  if (refused && route.ai === 'required') {
    return json({
      schema: ERROR_SCHEMA,
      error: 'ai_budget_spent',
      message: refused.reason === 'minute'
        ? 'This edge is answering too many AI requests this minute. Try again in a minute.'
        : refused.reason === 'off'
          ? `Workers AI is switched off here (the daily ${refused.class} cap is 0).`
          : refused.reason === 'too_large'
          ? `This model costs ${refused.units} units a run, more than the whole daily cap of ${refused.cap}. A smaller model fits.`
          : `Today's Workers AI budget for ${refused.class} is spent. It resets at 00:00 UTC.`,
      budget: refused,
      see: 'GET /api/ai/budget',
    }, 429, {
      'Cache-Control': 'no-store, max-age=0',
      // A run too large for the cap will not fit tomorrow either, so it gets no Retry-After.
      ...(refused.reason === 'too_large' || refused.reason === 'off' ? {} : { 'Retry-After': String(refused.retry_after_s ?? Math.max(1, Math.ceil((Date.parse(refused.resets_at) - Date.now()) / 1000))) }),
      'X-Artbitrage-AI-Budget': `spent; ${refused.class} ${refused.used}/${refused.cap}; ${refused.enforcement}`,
    });
  }
  const out = new Response(response.body, response);
  const shown = refused || last;
  out.headers.set('X-Artbitrage-AI-Budget', `${refused ? 'spent' : 'ok'}; ${shown.class} ${shown.used}/${shown.cap}; ${shown.enforcement}`);
  return out;
}

export async function handle(context, method = context.request.method) {
  const url = new URL(context.request.url);
  const found = router.find(method, url.pathname);
  if (!found) return stamp(method === 'OPTIONS' ? preflight(200) : notFound(url.pathname), method === 'OPTIONS' ? 'preflight' : 'not-found');
  const { route, params } = found;
  const ledger = [];
  const env = route.ai && context.env?.AI
    ? Object.create(context.env, { AI: { value: budgetedAI(context.env, ledger), enumerable: true } })
    : context.env;
  try {
    const response = await route.handler({
      ...context,
      env,
      url,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      params,
      routes: router.routes,
    });
    return stamp(route.ai ? labelBudget(response, route, ledger) : response, route.id);
  } catch (error) {
    console.error(`artbitrage route ${route.id} failed:`, error?.stack || error);
    return stamp(internalError(route.id), route.id);
  }
}
