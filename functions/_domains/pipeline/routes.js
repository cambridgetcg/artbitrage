// The pipeline: collect → enrich → distribute, for agents and humans.
import { json } from '../../_kernel/http.js';
import { boundedInt, safeString } from '../../_kernel/params.js';
import { MAX_SEARCH_LIMIT } from '../search/sources.js';
import { ArtbitragePipeline } from './pipeline.js';

const pipeline = new ArtbitragePipeline();
const TEXT_FORMATS = { csv: 'text/csv', ndjson: 'application/x-ndjson', markdown: 'text/markdown' };

export default [
  { id: 'pipeline.index', method: 'GET', path: '/api/pipeline', summary: 'Pipeline manifest', handler: () => json(pipeline.manifest()) },
  { id: 'pipeline.workflow', method: 'GET', path: '/api/pipeline/workflow', summary: 'Workflow guide', handler: () => json(pipeline.workflow()) },
  {
    id: 'pipeline.collect', method: 'GET', path: '/api/pipeline/collect',
    summary: 'Collect art from museums', params: 'q, limit, source',
    upstream: ['collectionapi.metmuseum.org', 'api.artic.edu', 'openaccess-api.clevelandart.org', 'commons.wikimedia.org', 'archive.org'],
    handler: async ({ env, query }) => {
      const q = safeString(query.q || 'love', 160) || 'love';
      const limit = boundedInt(query.limit, 3, 1, MAX_SEARCH_LIMIT);
      return json(await pipeline.collect(q, limit, query.source || 'default', env));
    },
  },
  {
    id: 'pipeline.enrich', method: 'GET', path: '/api/pipeline/enrich', ai: true,
    summary: 'Enrich a piece with AI metadata', params: 'id',
    reads: ['collection.json'],
    handler: async ({ env, query }) => {
      if (!query.id) return json({ error: 'id required' }, 400);
      return json(await pipeline.enrich(query.id, env));
    },
  },
  {
    id: 'pipeline.feed', method: 'GET', path: '/api/pipeline/feed',
    summary: 'Enriched feed', params: 'limit',
    reads: ['collection.json'],
    handler: async ({ env, query }) => json(await pipeline.feed(boundedInt(query.limit, 20, 1, 50), env)),
  },
  {
    id: 'pipeline.export', method: 'GET', path: '/api/pipeline/export',
    summary: 'Export collection', params: 'format=json|csv|ndjson|markdown',
    reads: ['collection.json'],
    handler: async ({ env, query }) => {
      const fmt = safeString(query.format, 10) || 'json';
      const exported = await pipeline.exportCollection(fmt, env);
      if (Object.hasOwn(TEXT_FORMATS, fmt)) return new Response(exported, { headers: { 'Content-Type': TEXT_FORMATS[fmt], 'Access-Control-Allow-Origin': '*' } });
      return json(exported);
    },
  },
  { id: 'pipeline.agent', method: 'GET', path: '/api/pipeline/agent', summary: 'Agent-optimized data package', reads: ['collection.json'], handler: async ({ env }) => json(await pipeline.agentPackage(env)) },
  { id: 'pipeline.human', method: 'GET', path: '/api/pipeline/human', summary: 'Human-friendly gallery view', reads: ['collection.json'], handler: async ({ env }) => json(await pipeline.humanView(env)) },
  {
    id: 'pipeline.ingest', method: 'POST', path: '/api/pipeline/ingest',
    summary: 'Ingest external art with enrichment',
    handler: async ({ env, request }) => {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }
      return json(await pipeline.ingest(body, env), 202);
    },
  },
];
