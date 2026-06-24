import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { onRequestGet, onRequestPost } from '../functions/api/[[route]].js';

const root = new URL('../', import.meta.url).pathname;
const originalFetch = globalThis.fetch;

const env = {
  ASSETS: {
    async fetch(url) {
      const path = new URL(url).pathname.replace(/^\//, '') || 'index.html';
      try {
        const text = await readFile(join(root, path), 'utf8');
        const type = path.endsWith('.json') ? 'application/json' : 'text/plain';
        return new Response(text, { status: 200, headers: { 'Content-Type': type } });
      } catch {
        return new Response('not found', { status: 404 });
      }
    },
  },
  AI: {
    async run() { return { response: 'Love is tested care.' }; },
  },
};

async function get(path) {
  const res = await onRequestGet({ request: new Request(`https://artbitrage.test${path}`), env });
  const json = await res.json();
  return { res, json };
}

async function post(path, body) {
  const res = await onRequestPost({
    request: new Request(`https://artbitrage.test${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
  });
  const json = await res.json();
  return { res, json };
}

function installSearchMock() {
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes('api.artic.edu')) {
      return Response.json({
        pagination: { total: 2 },
        data: [
          { id: 1, title: 'Love One', artist_title: 'A', date_display: '1901', image_id: 'abc', medium_display: 'oil', department_title: 'painting' },
          { id: 2, title: 'Love Two', artist_title: 'B', date_display: '1902', image_id: '', medium_display: 'ink', department_title: 'prints' },
        ],
      });
    }
    if (url.includes('openaccess-api.clevelandart.org')) {
      assert.match(url, /search=love/);
      return Response.json({
        info: { total: 2 },
        data: [
          { id: 3, title: 'Love Three', creators: [{ description: 'C' }], creation_date: '1903', images: { web: { url: 'https://img.test/3.jpg' } } },
          { id: 4, title: 'Love Four', creators: [{ description: 'D' }], creation_date: '1904', images: { url: 'https://img.test/4.jpg' } },
        ],
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

try {
  let out = await get('/api/stats');
  assert.equal(out.res.status, 200);
  assert.equal(typeof out.json.total_pieces, 'number');
  assert.ok(out.json.total_pieces > 0);

  out = await get('/api/art?limit=not-a-number&offset=-50');
  assert.equal(out.res.status, 200);
  assert.equal(out.json.limit, 20);
  assert.equal(out.json.offset, 0);
  assert.ok(Array.isArray(out.json.pieces));

  out = await get('/api/art/by-form/space');
  assert.equal(out.res.status, 200);
  assert.ok(out.json.pieces.every(piece => piece.form === 'space'));

  out = await get('/api/sources');
  assert.equal(out.res.status, 200);
  assert.equal(out.json.count, 5);
  assert.ok(out.json.sources.every(source => source.auth === 'none'));

  out = await get('/api/pipeline/workflow');
  assert.equal(out.res.status, 200);
  assert.equal(out.json.schema, 'artbitrage.workflow/1');
  assert.ok(out.json.quickstart.agent.includes('GET /data/agent-feed.json'));

  out = await get('/api/pipeline/agent');
  assert.equal(out.res.status, 200);
  assert.equal(out.json.schema.i, 'id');
  assert.ok(out.json.endpoints.static_ndjson.includes('/data/collection.ndjson'));

  out = await get('/api/pipeline/human');
  assert.equal(out.res.status, 200);
  assert.ok(out.json.explore.some(link => link.url === '/data/human-feed.md'));

  out = await get('/api/pipeline/feed?limit=9999');
  assert.equal(out.res.status, 200);
  assert.equal(out.json.pipeline, 'feed');
  assert.equal(out.json.max_limit, 50);
  assert.ok(out.json.limit <= 50);
  assert.ok(out.json.count <= 50);

  const ndjsonRes = await onRequestGet({ request: new Request('https://artbitrage.test/api/pipeline/export?format=ndjson'), env });
  assert.equal(ndjsonRes.status, 200);
  assert.match(ndjsonRes.headers.get('Content-Type'), /application\/x-ndjson/);
  const ndjsonText = await ndjsonRes.text();
  assert.ok(ndjsonText.trim().split('\n').length > 1);

  installSearchMock();
  out = await get('/api/search?q=love&limit=2&source=artic,cma');
  assert.equal(out.res.status, 200);
  assert.deepEqual(out.json.sources_requested, ['artic', 'cma']);
  assert.equal(out.json.limit, 2);
  assert.equal(out.json.sources_successful, 2);
  assert.equal(out.json.total_artworks_returned, 4);
  assert.equal(out.json.sources[0].artworks[0].source, 'artic');
  assert.equal(out.json.sources[1].artworks[0].source, 'cma');

  out = await get('/api/pipeline/collect?q=love&limit=2&source=artic,cma');
  assert.equal(out.res.status, 200);
  assert.equal(out.json.pipeline, 'collect');
  assert.equal(out.json.artworks_collected, 4);
  assert.match(out.json.human_summary, /Collected 4 artwork records/);

  out = await post('/api/art', { piece: 'a tiny bridge of tested love', form: 'word', artist: 'e2e' });
  assert.equal(out.res.status, 202);
  assert.equal(out.json.accepted, true);
  assert.equal(out.json.persisted, false);
  assert.match(out.json.art.id, /^submitted-/);
  assert.equal(out.json.art.piece, 'a tiny bridge of tested love');

  console.log('artbitrage API e2e passed');
} finally {
  globalThis.fetch = originalFetch;
}
