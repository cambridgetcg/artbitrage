// The Met's search contract: /v1/search was retired on 2026-10-01 (HTTP 410); /v1.1/search pages by offset and
// limit (default 100, at most 500). All three callers — the Pages router, the pipeline library and the cycle's
// sources.py — must ask v1.1 with an explicit page, keep fetching objects from /v1/objects, and survive an upstream
// failure as one failed source. Fixture-backed: no live Met request is made.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { onRequestGet } from '../functions/api/[[route]].js';
import { ArtbitragePipeline } from '../functions/_domains/pipeline/pipeline.js';

const SEARCH = 'https://collectionapi.metmuseum.org/public/collection/v1.1/search';
const OBJECT = 'https://collectionapi.metmuseum.org/public/collection/v1/objects/';
const originalFetch = globalThis.fetch;
const env = { ASSETS: { fetch: async () => new Response('not found', { status: 404 }) } };
const get = async path => (await onRequestGet({ request: new Request(`https://artbitrage.test${path}`), env })).json();

let calls = [];
function installMet({ searchStatus = 200 } = {}) {
  calls = [];
  globalThis.fetch = async input => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith('https://collectionapi.metmuseum.org/public/collection/v1/search')) {
      return Response.json({ message: '/public/collection/v1/search was retired on 2026-10-01.' }, { status: 410 });
    }
    if (url.startsWith(SEARCH)) {
      if (searchStatus !== 200) return Response.json({ message: 'upstream unavailable' }, { status: searchStatus });
      return Response.json({ total: 1756, objectIDs: [11, 12, 13] });
    }
    if (url.startsWith(OBJECT)) {
      const id = Number(url.slice(OBJECT.length));
      return Response.json({
        objectID: id, title: `Love ${id}`, artistDisplayName: 'Met Artist', objectDate: '1900', medium: 'oil',
        department: 'European Paintings', primaryImageSmall: id === 12 ? '' : `https://images.metmuseum.org/${id}.jpg`,
        objectURL: `https://www.metmuseum.org/art/collection/search/${id}`, isPublicDomain: true, creditLine: 'Rogers Fund',
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}
const searchCall = () => {
  const found = calls.filter(url => url.startsWith(SEARCH));
  assert.equal(found.length, 1, 'exactly one v1.1 search request');
  return new URL(found[0]);
};

try {
  // 1. The router's /api/search asks v1.1 with an explicit first page, then v1 objects.
  installMet();
  let out = await get('/api/search?q=love&limit=2&source=met');
  let url = searchCall();
  assert.equal(url.origin + url.pathname, SEARCH);
  assert.deepEqual([url.searchParams.get('hasImages'), url.searchParams.get('q'), url.searchParams.get('offset'), url.searchParams.get('limit')], ['true', 'love', '0', '16']);
  assert.ok(!calls.some(call => call.includes('/v1/search')), 'the retired endpoint is never called');
  assert.equal(out.sources_successful, 1);
  assert.equal(out.sources[0].total, 1756);
  assert.deepEqual(out.sources[0].artworks.map(work => work.id), ['11', '13'], 'objects without images are skipped');
  assert.equal(out.sources[0].artworks[0].rights.public_domain, true);
  assert.equal(out.sources[0].url, SEARCH, 'the source record names the live endpoint');

  // 2. /api/sources advertises the live endpoint, not the retired one.
  out = await get('/api/sources');
  assert.equal(out.sources.find(source => source.source === 'met').url, SEARCH);

  // 3. An upstream failure is one failed source, not a failed request.
  installMet({ searchStatus: 503 });
  out = await get('/api/search?q=love&limit=2&source=met');
  assert.equal(out.sources_successful, 0);
  assert.ok(out.sources[0].error, 'the failure is reported in-band');
  assert.deepEqual(out.sources[0].artworks || [], []);

  // 4. The pipeline library makes the same request, and caps the page at the Met's maximum of 500.
  const pipeline = new ArtbitragePipeline();
  installMet();
  const piped = await pipeline.searchSource('met', 'love', 3);
  url = searchCall();
  assert.equal(url.origin + url.pathname, SEARCH);
  assert.equal(url.searchParams.get('limit'), '24');
  assert.equal(url.searchParams.get('offset'), '0');
  assert.deepEqual(piped.artworks.map(work => work.id), ['11', '13']);
  installMet();
  await pipeline.searchSource('met', 'love', 100);
  assert.equal(searchCall().searchParams.get('limit'), '500', 'never ask for more than one v1.1 page allows');
} finally {
  globalThis.fetch = originalFetch;
}

// 5. The cycle's Python fetcher builds the same URLs (its _fetch is replaced, so nothing leaves the machine).
const script = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("sources", sys.argv[1])
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
f = mod.ArtFetcher()
seen = []
def fake(url):
    seen.append(url)
    if "/v1.1/search" in url: return {"total": 3, "objectIDs": [11, 12, 13]}
    if "/v1/objects/" in url: return {"primaryImage": "https://images.metmuseum.org/x.jpg", "title": "t"}
    return {"error": "unexpected " + url}
f._fetch = fake
out = f.fetch_met("love", 2)
print(json.dumps({"urls": seen, "count": len(out.get("artworks") or out.get("results") or [])}))
`;
const py = spawnSync('python3', ['-I', '-c', script, fileURLToPath(new URL('../sources.py', import.meta.url))], { encoding: 'utf8' });
assert.equal(py.status, 0, py.stderr);
const { urls } = JSON.parse(py.stdout.trim().split('\n').pop());
const first = new URL(urls[0]);
assert.equal(first.origin + first.pathname, SEARCH, 'sources.py searches v1.1');
assert.deepEqual([first.searchParams.get('q'), first.searchParams.get('offset'), first.searchParams.get('limit')], ['love', '0', '16']);
assert.ok(urls.slice(1).every(u => u.startsWith(OBJECT)), 'sources.py still reads objects from v1');
assert.ok(!urls.some(u => u.includes('/v1/search')), 'sources.py never calls the retired endpoint');

console.log('Met search contract PASS: router, pipeline and sources.py ask /v1.1/search with offset=0 and a capped limit; objects stay on /v1; upstream failure stays in-band.');
