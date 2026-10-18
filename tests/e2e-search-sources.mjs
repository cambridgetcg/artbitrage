// The open-search bridge reports what each museum actually said, and nothing
// more: AIC's collection-wide "total" is not a match count and its zero-score
// works are not matches; Commons gives no total; the Met's image-less
// candidates are checked a few at a time within a time budget; and the
// pipeline's collect stage normalises records exactly as /api/search does.
// Fixture-backed: no live request is made.
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/[[route]].js';

const originalFetch = globalThis.fetch;
const env = { ASSETS: { fetch: async () => new Response('not found', { status: 404 }) } };
const get = async path => (await onRequestGet({ request: new Request(`https://artbitrage.test${path}`), env })).json();
const calls = [];
let metDelayMs = 0;

globalThis.fetch = async input => {
  const url = String(input);
  calls.push(url);
  if (url.includes('api.artic.edu')) {
    assert.match(new URL(url).searchParams.get('fields'), /_score/, 'AIC is asked for relevance scores');
    return Response.json({ pagination: { total: 133170 }, data: [
      { id: 1, title: 'Matched', image_id: 'a', _score: 41.2, is_public_domain: true },
      { id: 2, title: 'Unmatched', image_id: 'b', _score: 0 },
    ] });
  }
  if (url.includes('commons.wikimedia.org')) return Response.json({ query: { pages: { 9: { pageid: 9, title: 'File:L.jpg', imageinfo: [{ url: 'https://upload.wikimedia.org/l.jpg', extmetadata: {} }] } } } });
  if (url.includes('/v1.1/search')) return Response.json({ total: 40, objectIDs: Array.from({ length: 40 }, (_, i) => 100 + i) });
  if (url.includes('/v1/objects/')) {
    if (metDelayMs) await new Promise(resolve => setTimeout(resolve, metDelayMs));
    const id = Number(url.split('/').pop());
    // Only every fifth candidate has a public image, like the Met's long tail.
    return Response.json({ objectID: id, title: `Met ${id}`, primaryImageSmall: id % 5 === 0 ? `https://images.metmuseum.org/${id}.jpg` : '', isPublicDomain: true });
  }
  if (url.includes('clevelandart')) return Response.json({ info: { total: 7 }, data: [] });
  if (url.includes('archive.org')) return Response.json({ response: { numFound: 3, docs: [] } });
  throw new Error(`unexpected ${url}`);
};

try {
  // 1. AIC: zero-score works are dropped, and the collection size is not a total.
  let out = await get('/api/search?q=zxqvbn&source=artic&limit=2');
  const artic = out.sources[0];
  assert.deepEqual(artic.artworks.map(w => w.title), ['Matched']);
  assert.deepEqual([artic.total, artic.total_is_exact, artic.total_reported], [null, false, 133170]);
  assert.match(artic.total_note, /whole collection, not the matches/);
  assert.equal(out.total_artworks_available, 0, 'the whole collection is never counted as available matches');
  assert.equal(out.total_artworks_available_is_exact, false);

  // 2. Commons reports no total: the page count is labelled, not passed off as one.
  out = await get('/api/search?q=love&source=wikimedia&limit=2');
  assert.deepEqual([out.sources[0].total, out.sources[0].total_is_exact], [1, false]);

  // 3. Exact sources stay exact.
  out = await get('/api/search?q=love&source=cma,internet_archive&limit=2');
  assert.deepEqual(out.sources.map(s => [s.total, s.total_is_exact]), [[7, true], [3, true]]);
  assert.deepEqual([out.total_artworks_available, out.total_artworks_available_is_exact], [10, true]);

  // 4. Met: candidates are read four at a time until enough images are found.
  calls.length = 0;
  out = await get('/api/search?q=love&source=met&limit=3');
  const met = out.sources[0];
  assert.deepEqual(met.artworks.map(w => w.id), ['100', '105', '110']);
  assert.equal(met.candidates_checked, 12, 'three batches of four found three images');
  assert.equal(calls.filter(u => u.includes('/v1/objects/')).length, 12);
  assert.equal(met.candidates_found, 24, 'eight candidates per wanted result');

  // 5. ...and no new batch starts once the time budget is spent.
  metDelayMs = 3100;
  const started = Date.now();
  out = await get('/api/search?q=slow&source=met&limit=10');
  metDelayMs = 0;
  assert.ok(out.sources[0].candidates_checked < 80, 'a slow Met stops early instead of reading every candidate');
  assert.ok(Date.now() - started < 12000, 'the search answers within the budget plus one batch');

  // 6. The pipeline's collect stage uses the same sources and the same record shape.
  const search = await get('/api/search?q=love&source=artic,wikimedia&limit=2');
  const collected = await get('/api/pipeline/collect?q=love&source=artic,wikimedia&limit=2');
  const strip = ({ collected_query, collected_at, pipeline_stage, ...record }) => record;
  assert.deepEqual(collected.artworks.map(strip), search.sources.flatMap(s => s.artworks));
  assert.equal(collected.artworks_available, search.total_artworks_available);

  // 7. /api/sources reports what this isolate has seen of each search.
  out = await get('/api/sources');
  const health = Object.fromEntries(out.sources.map(s => [s.source, s.health]));
  assert.equal(health.artic.observed, true);
  assert.match(health.artic.scope, /this edge isolate/);
  assert.ok(health.met.calls >= 2);

  console.log('search sources e2e passed: AIC zero scores and collection totals, Commons page counts, exact totals, Met batches and budget, shared pipeline records, source health');
} finally {
  globalThis.fetch = originalFetch;
}
