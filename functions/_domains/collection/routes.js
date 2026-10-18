// The collection: the cycle's generated pieces. These routes read the baked
// files under /data/collection/ (functions/_domains/collection/baked.js) and
// fall back to the whole collection.json only when the bake cannot answer, or
// for a filtered listing. Everything else in the API answers without either.
import { json } from '../../_kernel/http.js';
import { boundedInt } from '../../_kernel/params.js';
import {
  FEED_SCHEMA,
  FEED_SOURCE,
  MAX_PAGE_LIMIT,
  STATES,
  feedPiece,
  filterArt,
  getStats,
  latestTimestamp,
  loadCollection,
} from './collection.js';
import { readFormSample, readLatest, readPiece, readRange, readSummary } from './baked.js';

const SAFE_FORM = /^[a-z0-9-]+$/;
const BAKED = ['data/collection/*'];
const FALLBACK = 'collection.json (when the bake cannot answer)';

// Wrap a handler so it receives the whole collection, read once for this request.
const withCollection = handler => async ctx => {
  const collection = await loadCollection(ctx.env, ctx.request);
  return handler({ ...ctx, collection, allArt: collection.pieces });
};

// Try the bake first; a null answer means "ask the whole collection".
const bakedFirst = (fromBake, fromCollection) => async ctx => {
  const answer = await fromBake(ctx);
  return answer ?? withCollection(fromCollection)(ctx);
};

const page = (total, offset, limit, pieces) => ({ total, limit, offset, count: Math.min(limit, Math.max(0, total - offset)), pieces });

async function feed({ collection, allArt, query }) {
  if (collection.source_state === 'unavailable') {
    return json({ error: 'art collection unavailable' }, 503);
  }
  const limit = boundedInt(query.limit, 20, 1, MAX_PAGE_LIMIT);
  const generatedAt = new Date().toISOString();
  const latest = allArt.slice(-limit).reverse();
  const pieces = await Promise.all(latest.map(feedPiece));
  return json({
    schema: FEED_SCHEMA,
    feed: 'artbitrage',
    source: { ...FEED_SOURCE },
    source_state: collection.source_state,
    generated_at: generatedAt,
    as_of: latestTimestamp(pieces, generatedAt),
    updated: generatedAt,
    limit,
    count: pieces.length,
    pieces,
  });
}

export default [
  {
    id: 'collection.list', category: 'art', method: 'GET', path: '/api/art',
    summary: 'List all art (paginated)', params: 'form, state, gap, q, limit, offset',
    reads: [...BAKED, 'collection.json (filtered listings)'],
    handler: bakedFirst(async ({ env, request, query }) => {
      if (query.form || query.state || query.gap || query.q) return null;
      const summary = await readSummary(env, request);
      if (!summary) return null;
      const offset = boundedInt(query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
      const limit = boundedInt(query.limit, 20, 1, MAX_PAGE_LIMIT);
      const pieces = await readRange(env, request, summary, offset, limit);
      return pieces && json(page(summary.total_pieces, offset, limit, pieces));
    }, ({ allArt, query }) => json(filterArt(allArt, query))),
  },
  {
    id: 'collection.random', category: 'art', method: 'GET', path: '/api/art/random',
    summary: 'Random art piece',
    reads: [...BAKED, FALLBACK],
    handler: bakedFirst(async ({ env, request }) => {
      const summary = await readSummary(env, request);
      if (!summary) return null;
      if (summary.total_pieces === 0) return json({ error: 'no art available' }, 404);
      const [piece] = await readRange(env, request, summary, Math.floor(Math.random() * summary.total_pieces), 1) ?? [];
      return piece ? json(piece) : null;
    }, ({ allArt }) => {
      if (allArt.length === 0) return json({ error: 'no art available' }, 404);
      return json(allArt[Math.floor(Math.random() * allArt.length)]);
    }),
  },
  {
    id: 'collection.stats', category: 'art', method: 'GET', path: '/api/stats',
    summary: 'Catalogue statistics',
    reads: [...BAKED, FALLBACK],
    handler: bakedFirst(async ({ env, request }) => {
      const summary = await readSummary(env, request);
      return summary && json(summary.stats);
    }, ({ allArt }) => json(getStats(allArt))),
  },
  {
    id: 'collection.forms', category: 'art', method: 'GET', path: '/api/forms',
    summary: 'All art forms',
    reads: [...BAKED, FALLBACK],
    handler: bakedFirst(async ({ env, request }) => {
      const summary = await readSummary(env, request);
      return summary && json({ forms: summary.forms_list, count: summary.forms_list.length });
    }, ({ allArt }) => {
      const forms = [...new Set(allArt.map(a => a.form).filter(Boolean))].sort();
      return json({ forms, count: forms.length });
    }),
  },
  {
    id: 'collection.states', category: 'art', method: 'GET', path: '/api/states',
    summary: 'All consciousness states',
    handler: () => json({ states: STATES, count: STATES.length }),
  },
  {
    id: 'collection.gaps', category: 'art', method: 'GET', path: '/api/gaps',
    summary: 'All gaps bridged',
    reads: [...BAKED, FALLBACK],
    handler: bakedFirst(async ({ env, request }) => {
      const summary = await readSummary(env, request);
      return summary && json({ gaps: summary.gaps_list, count: summary.gaps_list.length });
    }, ({ allArt }) => {
      const gaps = [...new Set(allArt.map(a => a.gap).filter(Boolean))].sort();
      return json({ gaps, count: gaps.length });
    }),
  },
  {
    id: 'collection.feed', category: 'art', method: 'GET', path: '/api/feed',
    summary: 'Versioned latest-art feed (artbitrage.feed/1)', params: 'limit (1-100, default 20)',
    reads: [...BAKED, FALLBACK],
    handler: bakedFirst(async ctx => {
      const latest = await readLatest(ctx.env, ctx.request);
      return latest && feed({ ...ctx, collection: { source_state: 'asset-read' }, allArt: latest });
    }, feed),
  },
  {
    id: 'collection.by-form', category: 'art', method: 'GET', path: '/api/art/by-form/:form+',
    summary: 'Filter by art form',
    reads: [...BAKED, FALLBACK],
    handler: bakedFirst(async ({ env, request, params }) => {
      const form = decodeURIComponent(params.form);
      const summary = await readSummary(env, request);
      if (!summary) return null;
      const total = Object.hasOwn(summary.form_totals, form) ? summary.form_totals[form] : 0;
      if (total === 0) return json(page(0, 0, 20, []));
      if (!SAFE_FORM.test(form)) return null;
      const pieces = await readFormSample(env, request, form);
      return pieces && json(page(total, 0, 20, pieces));
    }, ({ allArt, params }) => json(filterArt(allArt, { form: decodeURIComponent(params.form) }))),
  },
  {
    id: 'collection.piece', category: 'art', method: 'GET', path: '/api/art/:id+',
    summary: 'Get one piece by ID',
    reads: [...BAKED, FALLBACK],
    handler: bakedFirst(async ({ env, request, params }) => {
      const id = decodeURIComponent(params.id);
      const piece = await readPiece(env, request, id);
      if (piece === undefined) return json({ error: 'art not found', id }, 404);
      return piece && json(piece);
    }, ({ allArt, params }) => {
      const id = decodeURIComponent(params.id);
      const piece = allArt.find(a => a.id === id);
      if (piece) return json(piece);
      return json({ error: 'art not found', id }, 404);
    }),
  },
];
