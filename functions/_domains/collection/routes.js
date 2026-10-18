// The collection: the cycle's generated pieces. Only these routes read
// collection.json; everything else in the API answers without it.
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

// Wrap a handler so it receives the collection, read once for this request.
const withCollection = handler => async ctx => {
  const collection = await loadCollection(ctx.env, ctx.request);
  return handler({ ...ctx, collection, allArt: collection.pieces });
};

export default [
  {
    id: 'collection.list', method: 'GET', path: '/api/art',
    summary: 'List all art (paginated)', params: 'form, state, gap, q, limit, offset',
    reads: ['collection.json'],
    handler: withCollection(({ allArt, query }) => json(filterArt(allArt, query))),
  },
  {
    id: 'collection.random', method: 'GET', path: '/api/art/random',
    summary: 'Random art piece',
    reads: ['collection.json'],
    handler: withCollection(({ allArt }) => {
      if (allArt.length === 0) return json({ error: 'no art available' }, 404);
      return json(allArt[Math.floor(Math.random() * allArt.length)]);
    }),
  },
  {
    id: 'collection.stats', method: 'GET', path: '/api/stats',
    summary: 'Catalogue statistics',
    reads: ['collection.json'],
    handler: withCollection(({ allArt }) => json(getStats(allArt))),
  },
  {
    id: 'collection.forms', method: 'GET', path: '/api/forms',
    summary: 'All art forms',
    reads: ['collection.json'],
    handler: withCollection(({ allArt }) => {
      const forms = [...new Set(allArt.map(a => a.form).filter(Boolean))].sort();
      return json({ forms, count: forms.length });
    }),
  },
  {
    id: 'collection.states', method: 'GET', path: '/api/states',
    summary: 'All consciousness states',
    handler: () => json({ states: STATES, count: STATES.length }),
  },
  {
    id: 'collection.gaps', method: 'GET', path: '/api/gaps',
    summary: 'All gaps bridged',
    reads: ['collection.json'],
    handler: withCollection(({ allArt }) => {
      const gaps = [...new Set(allArt.map(a => a.gap).filter(Boolean))].sort();
      return json({ gaps, count: gaps.length });
    }),
  },
  {
    id: 'collection.feed', method: 'GET', path: '/api/feed',
    summary: 'Versioned latest-art feed (artbitrage.feed/1)', params: 'limit (1-100, default 20)',
    reads: ['collection.json'],
    handler: withCollection(async ({ collection, allArt, query }) => {
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
    }),
  },
  {
    id: 'collection.by-form', method: 'GET', path: '/api/art/by-form/:form+',
    summary: 'Filter by art form',
    reads: ['collection.json'],
    handler: withCollection(({ allArt, params }) => json(filterArt(allArt, { form: decodeURIComponent(params.form) }))),
  },
  {
    id: 'collection.piece', method: 'GET', path: '/api/art/:id+',
    summary: 'Get one piece by ID',
    reads: ['collection.json'],
    handler: withCollection(({ allArt, params }) => {
      const id = decodeURIComponent(params.id);
      const piece = allArt.find(a => a.id === id);
      if (piece) return json(piece);
      return json({ error: 'art not found', id }, 404);
    }),
  },
];
