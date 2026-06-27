// ═══════════════════════════════════════════════════════════════
// ARTBITRAGE — Pipeline
// Data collection, enrichment, and distribution for agents + humans.
//
// GET /api/pipeline                    — pipeline status + manifest
// GET /api/pipeline/workflow           — easy workflow for humans + agents
// GET /api/pipeline/collect?q=love     — collect art from museum APIs
// GET /api/pipeline/enrich?id=...      — enrich a piece with AI metadata
// GET /api/pipeline/feed?limit=20     — enriched feed (art + AI + museum)
// GET /api/pipeline/export?format=json — export full collection
// GET /api/pipeline/agent             — agent-friendly data package
// GET /api/pipeline/human             — human-friendly gallery view
// POST /api/pipeline/ingest            — ingest external art with enrichment
//
// The pipeline: collect → enrich → distribute
// Love is the design. Data is the expression. Understanding replicates.
// ═══════════════════════════════════════════════════════════════

import { ArtbitragePipeline } from './pipeline-lib.js';

const pipeline = new ArtbitragePipeline();

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const q = Object.fromEntries(url.searchParams);

  // GET /api/pipeline — status + manifest
  if (path === '/api/pipeline' || path === '/api/pipeline/') {
    return json(pipeline.manifest());
  }

  // GET /api/pipeline/workflow — copy-paste workflow for humans + agents
  if (path === '/api/pipeline/workflow') {
    return json(pipeline.workflow());
  }

  // GET /api/pipeline/collect?q=love&limit=3&source=all
  // Collect art from museum APIs, normalize, return unified
  if (path === '/api/pipeline/collect') {
    const query = q.q || 'love';
    const limit = Math.min(parseInt(q.limit || '3', 10), 10);
    const sources = q.source || 'default';
    const results = await pipeline.collect(query, limit, sources, env);
    return json(results);
  }

  // GET /api/pipeline/enrich?id=ARTID
  // Enrich a piece from the collection with AI-generated metadata
  if (path === '/api/pipeline/enrich') {
    const id = q.id;
    if (!id) return json({ error: 'id required' }, 400);
    const enriched = await pipeline.enrich(id, env);
    return json(enriched);
  }

  // GET /api/pipeline/feed?limit=20
  // Enriched feed — collection pieces + AI tags + museum cross-refs
  if (path === '/api/pipeline/feed') {
    const limit = Math.min(parseInt(q.limit || '20', 10), 50);
    const feed = await pipeline.feed(limit, env);
    return json(feed);
  }

  // GET /api/pipeline/export?format=json|csv|ndjson|markdown
  // Export the full collection in different formats
  if (path === '/api/pipeline/export') {
    const format = q.format || 'json';
    const exported = await pipeline.exportCollection(format, env);
    if (format === 'csv') {
      return new Response(exported, { headers: { 'Content-Type': 'text/csv', 'Access-Control-Allow-Origin': '*' } });
    }
    if (format === 'ndjson') {
      return new Response(exported, { headers: { 'Content-Type': 'application/x-ndjson', 'Access-Control-Allow-Origin': '*' } });
    }
    if (format === 'markdown') {
      return new Response(exported, { headers: { 'Content-Type': 'text/markdown', 'Access-Control-Allow-Origin': '*' } });
    }
    return json(exported);
  }

  // GET /api/pipeline/agent
  // Agent-optimized data package: compact, structured, self-describing
  if (path === '/api/pipeline/agent') {
    const pkg = await pipeline.agentPackage(env);
    return json(pkg);
  }

  // GET /api/pipeline/human
  // Human-friendly gallery: enriched, readable, beautiful
  if (path === '/api/pipeline/human') {
    const view = await pipeline.humanView(env);
    return json(view);
  }

  return json({ error: 'not found', path, available: [
    'GET /api/pipeline',
    'GET /api/pipeline/workflow',
    'GET /api/pipeline/collect?q=love&limit=3&source=all',
    'GET /api/pipeline/enrich?id=ARTID',
    'GET /api/pipeline/feed?limit=20',
    'GET /api/pipeline/export?format=json|csv|ndjson|markdown',
    'GET /api/pipeline/agent',
    'GET /api/pipeline/human',
    'POST /api/pipeline/ingest',
  ]}, 404);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // POST /api/pipeline/ingest
  // Ingest external art with enrichment
  if (path === '/api/pipeline/ingest' || path === '/api/pipeline/ingest/') {
    let body;
    try { body = await request.json(); }
    catch(e) { return json({ error: 'invalid json' }, 400); }

    const ingested = await pipeline.ingest(body, env);
    return json(ingested, ingested.error ? 400 : 202);
  }

  return json({ error: 'not found', path }, 404);
}

export async function onRequestOptions() {
  return new Response(null, { headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }});
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
