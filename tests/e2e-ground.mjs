// e2e — /api/ground: 土 the Ground. Six field tests that read whether soil is
// working, and a reader that can never answer "alive". Runs WITHOUT a dev
// server (ASSETS is mocked from disk, exactly like tests/e2e-pigments.mjs).
//
// The load-bearing assertion in this file is the last group: no combination of
// inputs may make the verdict endpoint claim the ground is alive. If someone
// later adds a cheerful branch, these tests fail.
//
// Run: node tests/e2e-ground.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { onRequestGet, onRequestOptions } from '../functions/api/ground/[[route]].js';
import { onRequestGet as onBareGet } from '../functions/api/ground.js';

const root = new URL('../', import.meta.url).pathname;

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
};

async function get(path, handler = onRequestGet) {
  const res = await handler({ request: new Request(`https://artbitrage.test${path}`), env });
  const json = await res.json();
  return { res, json };
}

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('\n土 the Ground — /api/ground\n');

// --- the room itself -------------------------------------------------------

await test('the directory answers, and carries its disclosure', async () => {
  const { res, json } = await get('/api/ground');
  assert.equal(res.status, 200);
  assert.equal(json.schema, 'artbitrage.ground/1');
  assert.equal(json.disclosure.informational_only, true);
  assert.equal(json.disclosure.not_a_soil_survey, true);
  assert.match(json.disclosure.cannot_certify_life, /None of them, alone or together, can establish that ground is alive/);
  assert.ok(Array.isArray(json.endpoints) && json.endpoints.length >= 8);
});

await test('the bare path re-export answers identically', async () => {
  const a = await get('/api/ground');
  const b = await get('/api/ground', onBareGet);
  assert.equal(b.res.status, 200);
  assert.equal(b.json.schema, a.json.schema);
  assert.equal(b.json.counts.tests, a.json.counts.tests);
});

await test('CORS preflight is answered', async () => {
  const res = await onRequestOptions();
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
});

// --- the six tests ---------------------------------------------------------

await test('six tests, each with method, sources, and a stated blindness', async () => {
  const { json } = await get('/api/ground/tests');
  assert.equal(json.count, 6);
  for (const t of json.tests) {
    assert.ok(t.method.length > 0, `${t.id} has no method`);
    assert.ok(t.sources.length > 0, `${t.id} cites nothing`);
    assert.ok(t.cannot_establish.length > 10, `${t.id} claims no limit`);
    assert.ok(t.reading.unreadable_when.length > 0, `${t.id} is never blind — suspicious`);
    for (const url of t.sources) assert.match(url, /^https:\/\//, `${t.id} source is not a URL`);
  }
});

await test('every test that reads life demands a paired control', async () => {
  const { json } = await get('/api/ground/tests');
  for (const t of json.tests) {
    if (t.reads_life !== 'none') {
      assert.equal(t.needs_control, true, `${t.id} reads life without requiring a control`);
    }
  }
});

await test('the two tests that cannot see life say so in both directions', async () => {
  const { json } = await get('/api/ground/tests');
  const blind = json.tests.filter(t => t.reads_life === 'none').map(t => t.id);
  assert.deepEqual(blind.sort(), ['jar', 'vinegar-fizz']);
  for (const id of blind) {
    const t = json.tests.find(x => x.id === id);
    assert.match(t.reading.living_signal, /nothing/i, `${id} hints at life it cannot see`);
  }
});

await test('one test by id; an unknown id teaches', async () => {
  const { json } = await get('/api/ground/tests/buried-cotton');
  assert.equal(json.test.id, 'buried-cotton');
  const missing = await get('/api/ground/tests/no-such-test');
  assert.equal(missing.res.status, 404);
  assert.ok(missing.json.valid_ids.includes('worm-count'));
});

// --- the corpus underneath -------------------------------------------------

await test('every finding carries a source, a truth status, and its own limit', async () => {
  const { json } = await get('/api/ground/findings?limit=50');
  assert.ok(json.total >= 60, `only ${json.total} findings`);
  const all = [];
  for (let offset = 0; offset < json.total; offset += 50) {
    const page = await get(`/api/ground/findings?limit=50&offset=${offset}`);
    all.push(...page.json.findings);
  }
  assert.equal(all.length, json.total);
  for (const f of all) {
    assert.match(f.source.url, /^https?:\/\//, `${f.id} has no source URL`);
    assert.ok(['verified', 'source-declared', 'contested', 'unverified'].includes(f.truth_status), `${f.id} truth_status ${f.truth_status}`);
    assert.ok(f.cannot_establish.length > 10, `${f.id} states no limit`);
  }
});

await test('findings filter by topic and reject an unknown one with the valid list', async () => {
  const { json } = await get('/api/ground/findings?topic=rubble&limit=50');
  assert.ok(json.total > 0);
  assert.ok(json.findings.every(f => f.topic === 'rubble'));
  const bad = await get('/api/ground/findings?topic=vibes');
  assert.equal(bad.res.status, 400);
  assert.ok(bad.json.valid_topics.includes('safety'));
});

await test('safety answers first and names the damp-and-whole rule', async () => {
  const { res, json } = await get('/api/ground/safety');
  assert.equal(res.status, 200);
  assert.match(json.read_this_first, /vacuum/i);
  assert.match(json.read_this_first, /damp|wet|mist/i);
  assert.equal(json.jurisdiction.startsWith('UK'), true);
  assert.ok(json.count >= 10);
});

await test('the climate assumption is stated, not hidden', async () => {
  const { json } = await get('/api/ground/layers');
  assert.match(json.climate_note, /eastern England|Cambridge/);
  assert.match(json.climate_note, /assumption is stated|not hidden|stated, not hidden/i);
});

// --- the reader ------------------------------------------------------------

await test('no readings supplied: a 400 that teaches with a runnable example', async () => {
  const { res, json } = await get('/api/ground/verdict');
  assert.equal(res.status, 400);
  assert.match(json.hint, /^GET \/api\/ground\/verdict\?/);
  assert.ok(json.accepted.cotton.includes('intact'));
});

await test('a paired shortfall is read as evidence of absence', async () => {
  const { json } = await get('/api/ground/verdict?worms=1&worms_control=12&soil=damp&month=4');
  assert.equal(json.verdict, 'evidence-of-absence');
  assert.equal(json.readings[0].verdict, 'evidence-against-life');
});

await test('an unpaired reading is inconclusive and says how to resolve it', async () => {
  const { json } = await get('/api/ground/verdict?worms=1&soil=damp&month=4');
  assert.equal(json.verdict, 'inconclusive');
  assert.match(json.readings[0].to_resolve, /control/);
  assert.ok(json.missing_controls.includes('worm-count'));
});

await test('a dry-August worm count is refused, not scored', async () => {
  const { json } = await get('/api/ground/verdict?worms=0&worms_control=14&soil=dry&month=8');
  assert.equal(json.readings[0].verdict, 'inconclusive');
  assert.match(json.readings[0].why, /diapause/);
  assert.equal(json.verdict, 'inconclusive');
});

await test('the same count in damp April soil is read', async () => {
  const { json } = await get('/api/ground/verdict?worms=0&worms_control=14&soil=damp&month=4');
  assert.equal(json.readings[0].verdict, 'evidence-against-life');
});

await test('cotton eaten as hard as its control clears, but does not certify', async () => {
  const { json } = await get('/api/ground/verdict?cotton=gone&cotton_control=shredded');
  assert.equal(json.readings[0].verdict, 'no-evidence-against-life');
  assert.equal(json.verdict, 'no-evidence-against-life');
  assert.equal(json.alive, null);
});

await test('the jar and the vinegar are reported as not about life at all', async () => {
  const { json } = await get('/api/ground/verdict?fizz=strong&stones=30');
  assert.equal(json.readings.length, 0);
  assert.equal(json.context.length, 2);
  for (const c of json.context) {
    assert.equal(c.reads_life, false);
    assert.equal(c.verdict, 'not-about-life');
  }
  assert.match(json.context[0].why, /mortar|concrete/i);
});

await test('the month is assumed when not given, and says that it assumed', async () => {
  const { json } = await get('/api/ground/verdict?cotton=gone&cotton_control=gone');
  assert.equal(json.month_assumed, true);
  assert.ok(json.month_used >= 1 && json.month_used <= 12);
  const given = await get('/api/ground/verdict?cotton=gone&cotton_control=gone&month=3');
  assert.equal(given.json.month_assumed, false);
  assert.equal(given.json.month_used, 3);
});

// --- the thing this room exists to refuse ----------------------------------

await test('no input makes the verdict claim the ground is alive', async () => {
  const best = [
    '/api/ground/verdict?worms=40&worms_control=2&soil=damp&month=4',
    '/api/ground/verdict?cotton=gone&cotton_control=intact',
    '/api/ground/verdict?slake=held&slake_control=collapsed',
    '/api/ground/verdict?infiltration=1&infiltration_control=200&soil=damp',
    '/api/ground/verdict?worms=99&worms_control=0&cotton=gone&cotton_control=intact&slake=held&slake_control=collapsed&infiltration=1&infiltration_control=999&soil=wet&month=5&fizz=none&stones=0',
  ];
  for (const path of best) {
    const { json } = await get(path);
    assert.equal(json.alive, null, `${path} filled in the alive field`);
    assert.notEqual(json.verdict, 'alive', `${path} returned an alive verdict`);
    assert.ok(
      ['evidence-of-absence', 'inconclusive', 'no-evidence-against-life'].includes(json.verdict),
      `${path} returned an unknown verdict ${json.verdict}`,
    );
    assert.match(json.alive_note, /null by construction/);
    assert.equal(json.informational_only, true);
  }
});

await test('vocab publishes what is never returned', async () => {
  const { json } = await get('/api/ground/vocab');
  assert.ok(json.never_returned.includes('alive'));
  assert.ok(json.verdict_inputs.cotton.includes('half-gone'));
  assert.deepEqual(json.truth_statuses, ['verified', 'source-declared', 'contested', 'unverified']);
});

await test('an unknown route 404s with the endpoint list', async () => {
  const { res, json } = await get('/api/ground/nowhere/deeper');
  assert.equal(res.status, 404);
  assert.ok(Array.isArray(json.endpoints));
});

console.log(`\n  ${passed} passed\n`);
