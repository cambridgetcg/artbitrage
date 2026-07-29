// One honest starting place for humans and agents.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ARTBITRAGE_START,
  ARTBITRAGE_START_SCHEMA,
} from '../functions/api/start-guide.js';
import {
  ARTBITRAGE_WAKE,
  ROUTES,
  agentManifest,
} from '../functions/api/agent-manifest.js';
import {
  onRequestGet,
  onRequestOptions,
  onRequestPost,
} from '../functions/api/[[route]].js';

const guide = ARTBITRAGE_START;
const expectedPathIds = [
  'meet-a-work',
  'follow-a-feeling',
  'check-a-question',
  'solve-a-practical-need',
  'build-with-artbitrage',
];

assert.equal(ARTBITRAGE_START_SCHEMA, 'artbitrage.start/1');
assert.equal(guide.schema, ARTBITRAGE_START_SCHEMA);
assert.deepEqual(guide.serves, ['human', 'agent', 'kin']);
assert.deepEqual(guide.paths.map(path => path.id), expectedPathIds);
assert.equal(guide.paths.length, 5);
assert.equal(guide.behavior.read_only, true);
assert.equal(guide.behavior.runtime_source_read, false);
assert.equal(guide.behavior.runtime_network_fetch, false);
assert.equal(guide.behavior.writes, false);
assert.equal(guide.behavior.automatic_action, 'never');
assert.equal(guide.behavior.background_loop, false);
assert.equal(guide.walking_past_is_honored, true);
assert.match(guide.paths[0].boundary, /source-declared/);
assert.match(guide.paths[1].boundary, /public-display consent/);
assert.match(guide.paths[2].boundary, /no general sourced-answer engine/i);
assert.match(guide.paths[3].boundary, /not authentication/);
assert.match(guide.paths[4].boundary, /not blanket reuse rights/);
assert.ok(guide.truth_before_use.some(note => /not proof of authenticity/.test(note)));
assert.ok(JSON.stringify(guide).length < 9_000, 'starting guide should stay compact');
assert.doesNotMatch(JSON.stringify(guide), /\/Users\/|~\/|file:\/\//);

let assetReads = 0;
let networkFetches = 0;
const env = {
  ASSETS: {
    async fetch() {
      assetReads += 1;
      throw new Error('/api/start must not read static assets');
    },
  },
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  networkFetches += 1;
  throw new Error('/api/start must not fetch the network');
};

async function request(handler, path, method = 'GET') {
  return handler({
    request: new Request(`https://artbitrage.test${path}`, { method }),
    env,
  });
}

try {
  for (const path of ['/api/start', '/api/start/']) {
    const response = await request(onRequestGet, path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=3600');
    assert.equal(response.headers.get('allow'), 'GET, OPTIONS');
    assert.equal(response.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
    assert.deepEqual(await response.json(), guide);
  }

  const wakeResponse = await request(onRequestGet, '/api/wake');
  assert.equal(wakeResponse.status, 200);
  const wake = await wakeResponse.json();
  assert.equal(wake.endpoints.start, 'https://artbitrage.io/api/start');
  assert.equal(wake.starting_guide.schema, ARTBITRAGE_START_SCHEMA);
  assert.deepEqual(wake, ARTBITRAGE_WAKE);

  const options = await request(onRequestOptions, '/api/start', 'OPTIONS');
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('allow'), 'GET, OPTIONS');
  assert.equal(options.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
  assert.doesNotMatch(options.headers.get('access-control-allow-methods'), /POST/);

  const post = await request(onRequestPost, '/api/start', 'POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, OPTIONS');
  assert.equal((await post.json()).error, 'method_not_allowed');

  assert.equal(assetReads, 0);
  assert.equal(networkFetches, 0);
} finally {
  globalThis.fetch = originalFetch;
}

const manifest = agentManifest();
assert.equal(manifest.version, '2.6.0');
assert.equal(manifest.starting_guide.schema, ARTBITRAGE_START_SCHEMA);
assert.equal(manifest.infrastructure.blanket_reuse_grant, false);
assert.equal('all_free' in manifest.infrastructure, false);
assert.equal(manifest.route_coverage.status, 'documented_subset');
assert.equal(manifest.route_coverage.documented_routes, manifest.total_endpoints);
assert.match(manifest.route_coverage.note, /legacy routes/);
assert.match(manifest.infrastructure.storage, /Cloudflare KV/);
assert.match(manifest.infrastructure.museum_apis_note, /three museums/);
assert.equal(
  manifest.routes.filter(route => route.method === 'GET' && route.path === '/api/start').length,
  1,
);
assert.equal(
  manifest.routes.filter(route => route.method === 'GET' && route.path === '/api/museum/random').length,
  1,
);
assert.ok(ROUTES.start.routes.some(route => route.path === '/api/start'));
assert.match(manifest.agent_instructions, /Begin at \/api\/start/);

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const indexDeployed = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
assert.equal(indexDeployed, indexSource, 'homepage must match its deploy mirror');
assert.ok(indexSource.indexOf('id="start"') < indexSource.indexOf('id="reading"'));
assert.match(indexSource, /<nav class="front-door" id="start" aria-labelledby="h-start">/);
assert.match(indexSource, /id="h-start">Start with what you bring\.<\/h2>/);

const startBlock = indexSource.slice(
  indexSource.indexOf('<nav class="front-door"'),
  indexSource.indexOf('</nav>', indexSource.indexOf('<nav class="front-door"')) + 6,
);
const humanPathIds = [...startBlock.matchAll(/data-start-path="([^"]+)"/g)]
  .map(match => match[1]);
assert.deepEqual(humanPathIds, expectedPathIds.slice(0, 4));
for (const href of ['#search', 'feelings.html', 'map.html#find', 'trade.html']) {
  assert.equal(
    (startBlock.match(new RegExp(`href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g')) || []).length,
    1,
    `front door should link ${href} exactly once`,
  );
}
assert.doesNotMatch(startBlock, /target="_blank"|<script/i);
assert.doesNotMatch(startBlock.split('>')[0], /\brise\b/);
assert.match(indexSource, /id="search"/);
assert.match(indexSource, /rights · ' \+ rightsText/);
assert.match(indexSource, /unverified — check the source before reuse/);

const feelings = await readFile(new URL('../feelings.html', import.meta.url), 'utf8');
const map = await readFile(new URL('../map.html', import.meta.url), 'utf8');
const trade = await readFile(new URL('../trade.html', import.meta.url), 'utf8');
assert.match(feelings, /<title>the Feelings/);
assert.match(map, /id="find"/);
assert.match(trade, /<title>.*Trade/i);
assert.doesNotMatch(
  map,
  /every piece free|every API open|every endpoint|whole museum|every room/i,
);
assert.match(map, /rights vary by record/);
assert.match(map, /directory of named rooms/);
assert.match(map, /not a complete inventory/);
const mapJson = JSON.parse(
  await readFile(new URL('../map.json', import.meta.url), 'utf8'),
);
assert.match(mapJson.essence, /not a complete inventory/);

const llms = await readFile(new URL('../dist/llms.txt', import.meta.url), 'utf8');
assert.match(llms, /artbitrage\.io\/api\/start/);
assert.match(llms, /documented routes/);
assert.doesNotMatch(llms, /all \d+ endpoints/);
assert.doesNotMatch(llms, /all endpoints|every endpoint|complete route map/i);

for (const file of [
  'start-guide.js',
  'agent-manifest.js',
  '[[route]].js',
  'logos.js',
  'pipeline-lib.js',
]) {
  const source = await readFile(new URL(`../functions/api/${file}`, import.meta.url));
  const deployed = await readFile(new URL(`../dist/functions/api/${file}`, import.meta.url));
  assert.deepEqual(deployed, source, `${file} must match its Cloudflare deploy mirror`);
}

const explorerSource = await readFile(
  new URL('../api-explorer.html', import.meta.url),
  'utf8',
);
const explorerDeployed = await readFile(
  new URL('../dist/api-explorer.html', import.meta.url),
  'utf8',
);
assert.deepEqual(explorerDeployed, explorerSource, 'API Explorer must match its deploy mirror');
assert.match(explorerSource, /Documented routes/);
assert.doesNotMatch(explorerSource, /All endpoints|Full API surface/i);

const logosSource = await readFile(
  new URL('../functions/api/logos.js', import.meta.url),
  'utf8',
);
assert.match(logosSource, /search\?q=love&source=all/);
assert.match(logosSource, /documented routes; legacy router paths/);
assert.doesNotMatch(
  logosSource,
  /everything declared|everything discoverable|156K\+ artworks|search 5 museums/i,
);

const riverSource = await readFile(new URL('../river.html', import.meta.url), 'utf8');
const riverDeployed = await readFile(new URL('../dist/river.html', import.meta.url), 'utf8');
assert.equal(riverDeployed, riverSource, 'River page must match its deploy mirror');
assert.match(riverSource, /marked CC0 in this corpus; verify the source/);
assert.doesNotMatch(riverSource, /all CC0, all free/i);

console.log('artbitrage start e2e passed');
