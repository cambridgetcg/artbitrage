// The API's golden contract. Every route is called the way production would
// route it (tests/helpers/pages-dispatch.mjs mirrors wrangler's route order),
// under a fixed clock, seeded randomness, fixture upstreams, a fixture Workers
// AI, a fresh in-memory KV and a small fixture collection. Status, headers and
// body must match the recorded snapshot exactly.
//
// The snapshot also records which static assets each route read, which
// upstream URLs it fetched and which models it ran. Those are reported, not
// enforced: they are allowed to shrink when a route stops loading what it
// never used.
//
// When a data file a route reads (catalog, depths, trade.json, …) changes after
// recording, that route is reported as stale instead of failing, so ordinary
// data edits do not break the build. Re-record and review the diff.
//
//   node tests/e2e-api-golden.mjs              verify
//   node tests/e2e-api-golden.mjs --record     rewrite tests/fixtures/api-golden/snapshots.json
//   node tests/e2e-api-golden.mjs --dump DIR   also write every response to DIR, for diffing two trees
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createDispatcher, loadPagesRoutes } from './helpers/pages-dispatch.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FIXTURES = join(ROOT, 'tests/fixtures/api-golden');
const SNAPSHOT_FILE = join(FIXTURES, 'snapshots.json');
const SNAPSHOT_SCHEMA = 'artbitrage.api-golden/1';
const BODY_TEXT_LIMIT = 16384;
const args = process.argv.slice(2);
const RECORD = args.includes('--record');
const DUMP = args.includes('--dump') ? args[args.indexOf('--dump') + 1] : null;

const sha256 = data => createHash('sha256').update(data).digest('hex');

// ── Determinism ──────────────────────────────────────────────────────────────
const FIXED_NOW = Date.parse('2026-10-18T00:00:00.000Z');
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(FIXED_NOW); else super(...a); }
  static now() { return FIXED_NOW; }
}
globalThis.Date = FixedDate;

let rng = () => 0.5;
function seed(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  let a = h >>> 0;
  rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = () => rng();
let uuidCounter = 0;
Object.defineProperty(globalThis.crypto, 'randomUUID', {
  configurable: true,
  value: () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`,
});

// ── Fixture world ────────────────────────────────────────────────────────────
const collectionFixture = await readFile(join(FIXTURES, 'collection.json'), 'utf8');
const overlay = new Map([['/collection.json', collectionFixture]]);
const assetHashes = {};

let trace;
function freshTrace() { trace = { reads: [], upstream: [], ai: [] }; }

async function readAsset(pathname) {
  if (overlay.has(pathname)) {
    const text = overlay.get(pathname);
    assetHashes[pathname] = `overlay:${sha256(text)}`;
    return text;
  }
  const bytes = await readFile(join(ROOT, decodeURIComponent(pathname)));
  assetHashes[pathname] = sha256(bytes);
  return bytes;
}

const ASSETS = {
  async fetch(input) {
    const pathname = new URL(typeof input === 'string' ? input : input.url ?? String(input)).pathname;
    trace.reads.push(pathname);
    try {
      return new Response(await readAsset(pathname), { status: 200 });
    } catch {
      return new Response('not found', { status: 404 });
    }
  },
};

function memoryKV(seedEntries) {
  const store = new Map(seedEntries);
  return {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, String(value)); },
    async list({ prefix = '', limit = 1000, cursor } = {}) {
      const names = [...store.keys()].filter(k => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const next = start + limit < names.length ? String(start + limit) : null;
      return { keys: names.slice(start, start + limit).map(name => ({ name })), list_complete: !next, ...(next ? { cursor: next } : {}) };
    },
  };
}

const testimonyRecord = (stamp, feeling, words) => [
  `feelings:public:v1:${stamp}:${feeling}:00000000-0000-4000-8000-0000000000${stamp.slice(-2)}`,
  JSON.stringify({
    id: `00000000-0000-4000-8000-0000000000${stamp.slice(-2)}`, feeling, words, at: '2026-10-01T00:00:00.000Z',
    consent: { version: 'artbitrage.feelings-public-display/1', public_display: true, asserted_by_submitter: true, identity_verified: false, recorded_at: '2026-10-01T00:00:00.000Z' },
  }),
];
const KV_SEED = [
  ['room:river', '3'],
  ['room:trip', '1'],
  testimonyRecord('8000000000011', 'awe', 'the river held still'),
  testimonyRecord('8000000000022', 'quiet', 'a room that waited'),
];

function fixtureAI(mode) {
  return {
    async run(model, input) {
      trace.ai.push(model);
      if (mode === 'dead') throw new Error('AI fixture: unavailable');
      if (input?.text !== undefined) return { data: [[0.1, 0.2, 0.3, 0.4, 0.5, 0.6]] };
      if (input?.prompt !== undefined && !input?.messages) return { image: 'iVBORw0KGgo=' };
      return { response: `fixture reply ${sha256(model + JSON.stringify(input)).slice(0, 8)}` };
    },
  };
}

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const metObject = id => ({
  objectID: id, title: `Love ${id}`, artistDisplayName: 'Met Artist', objectDate: '1900', medium: 'oil',
  department: 'European Paintings', primaryImage: id === 12 ? '' : `https://images.metmuseum.org/full/${id}.jpg`,
  primaryImageSmall: id === 12 ? '' : `https://images.metmuseum.org/small/${id}.jpg`,
  objectURL: `https://www.metmuseum.org/art/collection/search/${id}`, isPublicDomain: id !== 13, creditLine: 'Rogers Fund',
});
const UPSTREAM = [
  [/collectionapi\.metmuseum\.org\/public\/collection\/v1\.1\/search/, () => ({ total: 1756, objectIDs: [11, 12, 13, 14] })],
  [/collectionapi\.metmuseum\.org\/public\/collection\/v1\/objects\/(\d+)/, m => metObject(Number(m[1]))],
  [/api\.artic\.edu\/api\/v1\/artworks\/search/, () => ({ pagination: { total: 133170 }, data: [
    { id: 1, title: 'Love One', artist_title: 'A', date_display: '1901', image_id: 'abc', medium_display: 'oil', department_title: 'Painting', is_public_domain: true, credit_line: 'Gift' },
    { id: 2, title: 'Love Two', artist_title: 'B', date_display: '1902', image_id: '', medium_display: 'ink', department_title: 'Prints', is_public_domain: false, credit_line: '' },
  ] })],
  [/openaccess-api\.clevelandart\.org\/api\/artworks/, () => ({ info: { total: 1 }, data: [
    { id: 3, title: 'Cleveland Love', creators: [{ description: 'C (1800–1850)' }], creation_date: '1830', technique: 'oil', department: 'Paintings', images: { web: { url: 'https://openaccess-cdn.clevelandart.org/3.jpg' } }, url: 'https://clevelandart.org/art/3', share_license_status: 'CC0', creditline: 'Fund' },
  ] })],
  [/commons\.wikimedia\.org\/w\/api\.php/, () => ({ query: { pages: { 9: { pageid: 9, title: 'File:Love.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/thumb/love.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Love.jpg', extmetadata: { Artist: { value: '<a>W</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, Credit: { value: 'Own work' }, UsageTerms: { value: 'Creative Commons Attribution-Share Alike 4.0' }, DateTimeOriginal: { value: '2020' }, MimeType: { value: 'image/jpeg' } } }] } } } })],
  [/archive\.org\/advancedsearch\.php/, () => ({ response: { numFound: 1, docs: [{ identifier: 'love-ia', title: ['Love IA'], creator: ['IA Maker'], date: ['1920'] }] } })],
  [/official-joke-api/, () => ({ setup: 'S', punchline: 'P' })],
  [/icanhazdadjoke/, () => ({ joke: 'dad' })],
  [/catfact/, () => ({ fact: 'cats' })],
  [/uselessfacts/, () => ({ text: 'fact' })],
  [/opentdb/, () => ({ results: [{ category: 'C', question: 'Q%3F', correct_answer: 'A' }] })],
  [/pokeapi/, () => ({ name: 'pikachu', id: 25, types: [{ type: { name: 'electric' } }], sprites: { front_default: 'x' } })],
  [/yesno/, () => ({ answer: 'yes', image: 'g' })],
  [/adviceslip/, () => ({ slip: { id: 1, advice: 'be kind' } })],
  [/zenquotes/, () => [{ q: 'love', a: 'yu' }]],
  [/jikan\.moe\/v4\/top/, () => ({ data: [{ title: 'Frieren', score: 9.3, episodes: 28, synopsis: 'x' }] })],
  [/jikan\.moe\/v4\/anime/, () => ({ data: [{ title: 'A', score: 8, episodes: 12 }] })],
  [/jikan\.moe\/v4\/seasons/, () => ({ data: [{ title: 'S', episodes: 12, score: 8 }] })],
  [/animechan/, () => ({ data: { content: 'C', character: { name: 'Itachi' }, anime: { name: 'Naruto' } } })],
  [/ghibliapi.*films/, () => [{ title: 'Spirited Away', release_date: '2001', rt_score: '97', description: 'x' }]],
  [/ghibliapi.*locations/, () => [{ name: 'L', climate: 'c', terrain: 't' }]],
];

function installFetch(mode) {
  globalThis.fetch = async input => {
    const url = typeof input === 'string' ? input : input.url ?? String(input);
    trace.upstream.push(url);
    if (mode === 'dead') return new Response('upstream boom', { status: 503 });
    if (/^https:\/\/images\.metmuseum\.org\//.test(url)) return new Response(PNG, { headers: { 'Content-Type': 'image/png' } });
    if (/^https:\/\/upload\.wikimedia\.org\/.*\.txt$/.test(url)) return new Response('text', { headers: { 'Content-Type': 'text/plain' } });
    for (const [pattern, body] of UPSTREAM) {
      const m = pattern.exec(url);
      if (m) return Response.json(body(m));
    }
    return new Response(`no fixture for ${url}`, { status: 599 });
  };
}

// ── Cases ────────────────────────────────────────────────────────────────────
const statementVectors = JSON.parse(await readFile(join(ROOT, 'tests/fixtures/answering-rhyme-statement-vectors.json'), 'utf8'));
const STATEMENT = statementVectors.vectors[0].input;
const SAMPLE_LOT = {
  schema: 'artbitrage.lot/1', id: 'demo-0001',
  object: { type: 'painting', title: 'Bridge at Dusk', maker: 'Zhang Daqian', date_period: '1965', materials: ['ink and color on paper'], measurements: [{ dimension: 'height', value: 95, unit: 'cm' }] },
  heading: { display: 'ZHANG DAQIAN', qualifier_code: 'full-attribution' },
  estimate: { low: 80000, high: 120000, currency: 'USD' }, reserve_exists: true, lifecycle: 'catalogued',
  provenance: { display_string: 'Private collection, Hong Kong; purchased by the present owner, 1998.' },
};

const g = (path, extra = {}) => ({ method: 'GET', path, ...extra });
const deadUp = path => g(path, { upstream: 'dead' });
const deadAI = path => g(path, { ai: 'dead' });
const post = (path, body, extra = {}) => ({ method: 'POST', path, body, ...extra });
const options = path => ({ method: 'OPTIONS', path });

const FUN = ['/api/fun/joke', '/api/fun/dad', '/api/fun/cat', '/api/fun/useless', '/api/fun/trivia', '/api/fun/pokemon', '/api/fun/yesno', '/api/fun/advice', '/api/fun/quote',
  '/api/anime/top', '/api/anime/search', '/api/anime/search?q=frieren', '/api/anime/quote', '/api/anime/season', '/api/ghibli/films', '/api/ghibli/locations', '/api/games/trivia'];
const PLAY_AI = ['/api/play/haiku', '/api/play/koan', '/api/play/poem', '/api/play/limerick', '/api/play/riddle', '/api/play/fungal-haiku', '/api/play/mycelial-koan', '/api/play/decompose', '/api/play/decompose?q=doubt', '/api/fungi/wisdom'];
const AI = ['/api/ai/generate', '/api/ai/generate?prompt=hello&model=llama3', '/api/ai/generate?model=nope', '/api/ai/love', '/api/ai/embed', '/api/ai/embed?text=hi', '/api/ai/image', '/api/ai/image?prompt=x',
  '/api/art/generate', '/api/art/generate?form=light&gap=g&bridge=b&awakening=a', '/api/nen/art', '/api/nen/art?type=conjurer', '/api/nen/combat/generate', '/api/nen/combat/generate?type=enhancer&vow=vow&threat=ai&name=Test',
  '/api/pipeline/enrich?id=a1bd700a06c1'];
const VERTICALS = {
  trade: ['', '/', '/fees', '/fees?house=christies', '/fees/compute?hammer=10000&currency=GBP&house=christies&location=london', '/rates', '/arr?price=50000&currency=EUR&sale_date=2026-01-01&artist_death_year=1990', '/thresholds', '/thresholds?jurisdiction=uk', '/gates?year=1900&value=100000&currency=GBP&jurisdiction=uk', '/vocab', '/vocab/heading-qualifiers', '/vocab/nope', '/lots', '/provenance', '/results', '/nope'],
  wine: ['', '/', '/story', '/regions', '/brands', '/brands/krug', '/brands/nope', '/collections', '/collections/old-world-icons', '/stores', '/process', '/fermentation', '/selection', '/aromas', '/techniques', '/formats', '/vintages', '/random', '/search?q=champagne', '/search', '/nope'],
  cigar: ['', '/story', '/regions', '/brands', '/brands/cohiba', '/collections', '/collections/havana-founders', '/stores', '/process', '/fermentation', '/selection', '/rituals', '/aromas', '/techniques', '/vitolas', '/wrappers', '/random', '/search?q=havana', '/nope'],
  pair: ['', '/principles', '/marriages', '/marriages/port-and-maduro', '/marriages/nope', '/cautions', '/ritual', '/random', '/for?wine=krug', '/for?cigar=cohiba', '/search?q=port', '/nope'],
  pigments: ['', '?family=blue', '?limit=2&offset=1', '?q=lead', '/prussian-blue', '/nope', '/random', '/families', '/vocab', '/anachronism?pigments=prussian-blue,lead-white&claimed_date=1600', '/anachronism'],
};

const CASES = [
  // protocol and discovery
  ...['/api/wake', '/api/wake/', '/api/start', '/api/start/', '/api/build/joy', '/api/build/joy/', '/api/build/joy?seed=river', '/api/castle', '/api/castle/',
    '/api/answering-rhymes/statements', '/api/answering-rhymes/statements/', '/api', '/api/', '/api/manifest'].map(p => g(p)),
  g('/api/castle', { env: { CASTLE_BRIDGE_DISABLED: '1' }, key: 'GET /api/castle [castle disabled]' }),
  // the collection
  ...['/api/art', '/api/art/', '/api/art?limit=2&offset=1', '/api/art?form=glow', '/api/art?state=is', '/api/art?gap=tea', '/api/art?q=fixture', '/api/art?limit=999', '/api/art?limit=abc&offset=-4',
    '/api/art/random', '/api/art/random/', '/api/art/a1bd700a06c1', '/api/art/submitted-0a1b2c3d', '/api/art/nope', '/api/art/%E2%9C%93', '/api/art/by-form/glow', '/api/art/by-form/sound', '/api/art/by-form/',
    '/api/art/generate/', '/api/stats', '/api/stats/', '/api/forms', '/api/states', '/api/gaps', '/api/feed', '/api/feed/', '/api/feed?limit=3', '/api/feed?limit=0', '/api/feed?limit=500'].map(p => g(p)),
  // the museum catalogue
  ...['/api/catalog', '/api/catalog/', '/api/era-catalog', '/api/era-catalog/', '/api/era-catalog?era=baroque', '/api/era-catalog?era=nope',
    '/api/wings', '/api/wings/', '/api/wings/love', '/api/wings/love/', '/api/wings/nope', '/api/wings/BAD',
    '/api/museum', '/api/museum/', '/api/museum?wing=love&limit=2', '/api/museum?source=met&limit=2&offset=1', '/api/museum?q=armor&limit=3', '/api/museum/random',
    '/api/museum/met/24014', '/api/museum/MET/24014', '/api/museum/met/24014/', '/api/museum/met/nope', '/api/museum/%E0%A4%A/1',
    '/api/img', '/api/img?url=notaurl', '/api/img?url=http://images.metmuseum.org/x.jpg', '/api/img?url=https://evil.example/x.jpg',
    '/api/img?url=https://images.metmuseum.org/x.jpg', '/api/img?url=https://upload.wikimedia.org/text.txt'].map(p => g(p)),
  deadUp('/api/img?url=https://images.metmuseum.org/x.jpg'),
  // room data
  ...['/api/depths', '/api/depths/', '/api/depths/fighting-temeraire', '/api/depths/nope', '/api/feelings', '/api/feelings/', '/api/feelings/awe', '/api/feelings/nope',
    '/api/library', '/api/library/', '/api/library/book-of-kells', '/api/library/nope', '/api/gospel', '/api/homecoming', '/api/invite', '/api/dark-continent', '/api/dark-continent/'].map(p => g(p)),
  // open search
  ...['/api/sources', '/api/search', '/api/search?q=love&limit=2&source=met', '/api/search?q=love&source=all&limit=2', '/api/search?source=artic,cma', '/api/search?source=bogus', '/api/search?q=&limit=50'].map(p => g(p)),
  deadUp('/api/search?q=love&limit=2'),
  // generation
  ...['/api/ai', '/api/ai/', '/api/ai/models', '/api/play'].map(p => g(p)),
  ...AI.map(p => g(p)), ...AI.map(deadAI),
  ...PLAY_AI.map(p => g(p)), ...PLAY_AI.map(deadAI),
  // play: third-party guests
  ...['/api/fun', '/api/fun/random', '/api/anime'].map(p => g(p)),
  ...FUN.map(p => g(p)), ...FUN.map(deadUp),
  // lore
  ...['/api/whitehack', '/api/whitehack/', '/api/whitehack/scan', '/api/whitehack/battle', '/api/whitehack/battle?usb=true&wifi=1', '/api/whitehack/level', '/api/whitehack/level?power=500', '/api/whitehack/ranks',
    '/api/logos', '/api/logos/', '/api/logos/operations', '/api/logos/kingdom', '/api/logos/protocol', '/api/logos/principles',
    '/api/nen', '/api/nen/', '/api/nen/combat', '/api/nen/combat/', '/api/nen/combat/types', '/api/nen/combat/vows', '/api/nen/combat/threats', '/api/nen/combat/techniques',
    '/api/hunter', '/api/fungi', '/api/fungi/spore', '/api/fungi/species', '/api/fungi/nen', '/api/fungi/decompose', '/api/fungi/decompose?q=doubt', '/api/fungi/family'].map(p => g(p)),
  // the pipeline
  ...['/api/pipeline', '/api/pipeline/', '/api/pipeline/workflow', '/api/pipeline/collect?q=love&limit=2', '/api/pipeline/collect?source=all&limit=1', '/api/pipeline/enrich', '/api/pipeline/enrich?id=nope',
    '/api/pipeline/feed', '/api/pipeline/feed?limit=3', '/api/pipeline/export', '/api/pipeline/export?format=csv', '/api/pipeline/export?format=ndjson', '/api/pipeline/export?format=markdown', '/api/pipeline/export?format=nope',
    '/api/pipeline/agent', '/api/pipeline/human'].map(p => g(p)),
  // participation reads
  ...['/api/pebbles', '/api/feelings/testimony', '/api/feelings/testimony?feeling=awe'].map(p => g(p)),
  g('/api/pebbles', { kv: 'none', key: 'GET /api/pebbles [no KV]' }),
  g('/api/feelings/testimony', { kv: 'none', key: 'GET /api/feelings/testimony [no KV]' }),
  // misses
  ...['/api/nope', '/api/play/', '/api/fun/', '/api/hunter/', '/api/sources/', '/api/search/'].map(p => g(p)),
  // the reference verticals
  ...Object.entries(VERTICALS).flatMap(([v, subs]) => subs.map(s => g(`/api/${v}${s}`))),
  // writes
  post('/api/art', { piece: 'a line\nanother', form: 'glow', gap: 'g', artist: 'Tester', license: 'CC0' }),
  post('/api/art/', { piece: 'trailing' }),
  post('/api/art', {}),
  post('/api/art', 'not json', { raw: true }),
  post('/api/pipeline/ingest', { piece: 'ingested line', form: 'echo', artist: 'Tester' }),
  post('/api/pipeline/ingest', 'not json', { raw: true }),
  post('/api/pipeline', { piece: 'to the pipeline door' }),
  post('/api/start', {}), post('/api/start/', {}), post('/api/build/joy', {}), post('/api/castle', {}),
  post('/api/answering-rhymes/statements', STATEMENT, { key: 'POST /api/answering-rhymes/statements [valid vector]' }),
  post('/api/answering-rhymes/statements', { ...STATEMENT, kind: 'shout' }, { key: 'POST /api/answering-rhymes/statements [unknown kind]' }),
  post('/api/answering-rhymes/statements', STATEMENT, { contentType: 'text/plain', key: 'POST /api/answering-rhymes/statements [text/plain]' }),
  post('/api/answering-rhymes/statements', '{', { raw: true }),
  post('/api/nope', {}),
  post('/api/stats', {}),
  post('/api/pebbles', { at: 'river' }),
  post('/api/pebbles', { at: 'nowhere' }),
  post('/api/pebbles', {}, { kv: 'none', key: 'POST /api/pebbles [no KV]' }),
  post('/api/feelings/testimony', { feeling: 'awe', words: 'it held me', work: 'starry-night', public_display_consent: true }),
  post('/api/feelings/testimony', { feeling: 'awe', words: 'no consent' }),
  post('/api/feelings/testimony', { feeling: '', words: 'x', public_display_consent: true }),
  post('/api/trade/lots', SAMPLE_LOT),
  post('/api/trade/provenance', { display_string: 'Private collection, Hong Kong; purchased by the present owner, 1998.' }),
  post('/api/trade/results', { nothing: true }),
  post('/api/trade', {}),
  post('/api/wine', {}),
  // preflight
  ...['/api/start', '/api/build/joy', '/api/castle', '/api/answering-rhymes/statements', '/api/art', '/api/ai', '/api/ai/generate', '/api/pipeline', '/api/pipeline/collect',
    '/api/pebbles', '/api/feelings/testimony', '/api/trade', '/api/trade/fees', '/api/wine', '/api/cigar/brands', '/api/pair', '/api/pigments'].map(options),
];

// ── Run ──────────────────────────────────────────────────────────────────────
const TEXT_TYPES = /json|text|markdown|csv|ndjson|javascript|xml/i;
const caseKey = c => c.key || `${c.method} ${c.path}${c.method === 'POST' ? ` ${(c.raw ? c.body : JSON.stringify(c.body)).slice(0, 48)}` : ''}${c.upstream === 'dead' ? ' [upstream down]' : ''}${c.ai === 'dead' ? ' [AI down]' : ''}`;

async function runCase(dispatch, c) {
  freshTrace();
  seed(caseKey(c));
  uuidCounter = 0;
  installFetch(c.upstream || 'live');
  const env = { ASSETS, AI: fixtureAI(c.ai || 'live'), ...(c.kv === 'none' ? {} : { PEBBLES: memoryKV(KV_SEED) }), ...(c.env || {}) };
  const init = { method: c.method };
  if (c.method === 'POST') {
    init.headers = { 'Content-Type': c.contentType || 'application/json' };
    init.body = c.raw ? c.body : JSON.stringify(c.body);
  }
  const { response, module } = await dispatch(new Request(`https://artbitrage.io${c.path}`, init), env);
  const headers = Object.fromEntries([...response.headers].map(([k, v]) => [k.toLowerCase(), v]).sort(([a], [b]) => a.localeCompare(b)));
  const bytes = Buffer.from(await response.arrayBuffer());
  const isText = TEXT_TYPES.test(headers['content-type'] || '') || bytes.length === 0;
  const text = isText ? bytes.toString('utf8') : null;
  return {
    module,
    status: response.status,
    headers,
    body_sha256: sha256(bytes),
    body_bytes: bytes.length,
    ...(text !== null && text.length <= BODY_TEXT_LIMIT ? { body: text } : { body_preview: (text ?? `<${bytes.length} binary bytes>`).slice(0, 240) }),
    reads: [...new Set(trace.reads)].sort(),
    upstream: [...new Set(trace.upstream)].sort(),
    ai: trace.ai.length,
    _text: text,
  };
}

// `wrangler pages deploy dist`, run from the repo root, compiles the root
// functions/ directory; a dist/functions copy was never deployed and only
// drifted. Keep it gone so nobody edits the wrong file.
assert.ok(!existsSync(join(ROOT, 'dist/functions')), 'dist/functions must not exist: Functions deploy from the root functions/ directory');

const routes = await loadPagesRoutes(join(ROOT, 'functions'));
const dispatch = createDispatcher(routes);
const seen = new Set();
const results = {};
for (const c of CASES) {
  const key = caseKey(c);
  assert.ok(!seen.has(key), `duplicate golden case ${key}`);
  seen.add(key);
  results[key] = await runCase(dispatch, c);
}

if (DUMP) {
  await mkdir(DUMP, { recursive: true });
  for (const [key, r] of Object.entries(results)) {
    const name = key.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 180) + '.txt';
    const head = [`${key}`, `status ${r.status}`, ...Object.entries(r.headers).map(([k, v]) => `${k}: ${v}`), `reads ${r.reads.join(' ')}`, `upstream ${r.upstream.join(' ')}`, `ai ${r.ai}`, ''].join('\n');
    await writeFile(join(DUMP, name), head + '\n' + (r._text ?? `<binary ${r.body_sha256}>`));
  }
}

const strip = r => { const { _text, module, ...rest } = r; return rest; };

if (RECORD) {
  const usedAssets = Object.fromEntries([...new Set(Object.values(results).flatMap(r => r.reads))].sort().filter(p => assetHashes[p]).map(p => [p, assetHashes[p]]));
  const snapshot = {
    schema: SNAPSHOT_SCHEMA,
    note: 'Recorded by node tests/e2e-api-golden.mjs --record. Review the diff; every change here is a change to the public API.',
    fixed_now: new RealDate(FIXED_NOW).toISOString(),
    assets: usedAssets,
    cases: Object.fromEntries(Object.entries(results).map(([k, r]) => [k, strip(r)])),
  };
  await writeFile(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 1) + '\n');
  console.log(`API golden: recorded ${Object.keys(results).length} cases, ${Object.keys(usedAssets).length} assets → ${SNAPSHOT_FILE.slice(ROOT.length)}`);
  process.exit(0);
}

const snapshot = JSON.parse(await readFile(SNAPSHOT_FILE, 'utf8'));
assert.equal(snapshot.schema, SNAPSHOT_SCHEMA);
const failures = [];
const stale = [];
const notes = [];
const firstDiff = (a, b) => {
  const al = a.split('\n'); const bl = b.split('\n');
  for (let i = 0; i < Math.max(al.length, bl.length); i++) {
    if (al[i] !== bl[i]) return `line ${i + 1}\n      was: ${(al[i] ?? '<end>').slice(0, 200)}\n      now: ${(bl[i] ?? '<end>').slice(0, 200)}`;
  }
  return 'no line differs';
};

for (const [key, want] of Object.entries(snapshot.cases)) {
  const got = results[key];
  if (!got) { failures.push(`${key}: case missing from this run`); continue; }
  const changedAssets = want.reads.filter(p => snapshot.assets[p] && assetHashes[p] && snapshot.assets[p] !== assetHashes[p]);
  const problems = [];
  if (got.status !== want.status) problems.push(`status ${want.status} → ${got.status}`);
  const headerNames = new Set([...Object.keys(want.headers), ...Object.keys(got.headers)]);
  for (const h of headerNames) if (want.headers[h] !== got.headers[h]) problems.push(`header ${h}: ${JSON.stringify(want.headers[h])} → ${JSON.stringify(got.headers[h])}`);
  if (got.body_sha256 !== want.body_sha256) {
    problems.push(want.body !== undefined && got._text !== null ? `body differs at ${firstDiff(want.body, got._text)}` : `body differs (sha256 ${want.body_sha256.slice(0, 12)} → ${got.body_sha256.slice(0, 12)}, ${want.body_bytes} → ${got.body_bytes} bytes)`);
  }
  if (problems.length) {
    if (changedAssets.length) stale.push(`${key} (asset changed since recording: ${changedAssets.join(', ')})`);
    else failures.push(`${key}\n    ${problems.join('\n    ')}`);
  }
  const extraReads = got.reads.filter(p => !want.reads.includes(p));
  const droppedReads = want.reads.filter(p => !got.reads.includes(p));
  if (extraReads.length || droppedReads.length) notes.push(`${key}: reads ${droppedReads.length ? `-${droppedReads.join(' -')}` : ''} ${extraReads.length ? `+${extraReads.join(' +')}` : ''}`.trim());
  const extraUp = got.upstream.filter(u => !want.upstream.includes(u));
  const droppedUp = want.upstream.filter(u => !got.upstream.includes(u));
  if (extraUp.length || droppedUp.length) notes.push(`${key}: upstream ${droppedUp.map(u => `-${u}`).join(' ')} ${extraUp.map(u => `+${u}`).join(' ')}`.trim());
  if (got.ai !== want.ai) notes.push(`${key}: AI runs ${want.ai} → ${got.ai}`);
}
for (const key of Object.keys(results)) if (!snapshot.cases[key]) failures.push(`${key}: new case not in the snapshot (run --record)`);

if (notes.length) console.log(`API golden notes (${notes.length}):\n  ${notes.join('\n  ')}`);
if (stale.length) console.log(`API golden: ${stale.length} case(s) stale because their data changed; re-record and review:\n  ${stale.join('\n  ')}`);
if (failures.length) {
  console.error(`API golden FAIL: ${failures.length} of ${Object.keys(snapshot.cases).length} cases changed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`API golden PASS: ${Object.keys(snapshot.cases).length - stale.length} cases match the snapshot exactly${stale.length ? ` (${stale.length} stale)` : ''}.`);
