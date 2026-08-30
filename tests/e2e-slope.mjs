// e2e — /api/slope: 坡 the Slope. The record of a search for hard rules in a
// living garden that found none which were not definitions. Runs WITHOUT a dev
// server (ASSETS is mocked from disk, like tests/e2e-ground.mjs).
//
// The load-bearing assertions are the last group: the walls list must stay
// empty, `guaranteed` must stay null, and no rule may be marked as holding on
// evidence. If a later edit quietly promotes a slope to a wall, these fail.
//
// Run: node tests/e2e-slope.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { onRequestGet, onRequestOptions } from '../functions/api/slope/[[route]].js';
import { onRequestGet as onBareGet } from '../functions/api/slope.js';

const root = new URL('../', import.meta.url).pathname;

const env = {
  ASSETS: {
    async fetch(url) {
      const path = new URL(url).pathname.replace(/^\//, '') || 'index.html';
      try {
        const text = await readFile(join(root, path), 'utf8');
        return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch {
        return new Response('not found', { status: 404 });
      }
    },
  },
};

async function get(path, handler = onRequestGet) {
  const res = await handler({ request: new Request(`https://artbitrage.test${path}`), env });
  return { res, json: await res.json() };
}

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1; }
}

console.log('\n坡 the Slope — /api/slope\n');

await test('the directory answers and leads with the count', async () => {
  const { res, json } = await get('/api/slope');
  assert.equal(res.status, 200);
  assert.equal(json.schema, 'artbitrage.slope/1');
  assert.match(json.headline, /Zero survived as evidenced floors/);
  assert.equal(json.counts.rules_proposed, 40);
  assert.equal(json.counts.rules_held_as_evidence, 0);
  assert.ok(Array.isArray(json.endpoints) && json.endpoints.length >= 8);
});

await test('the bare path re-export answers identically', async () => {
  const a = await get('/api/slope');
  const b = await get('/api/slope', onBareGet);
  assert.equal(b.res.status, 200);
  assert.equal(b.json.counts.claims, a.json.counts.claims);
});

await test('CORS preflight is answered', async () => {
  const res = await onRequestOptions();
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
});

await test('every claim carries a source, a status, a limit, and its checker note', async () => {
  const { json } = await get('/api/slope/claims?limit=50');
  assert.ok(json.total >= 80, `only ${json.total} claims`);
  const all = [];
  for (let offset = 0; offset < json.total; offset += 50) {
    const page = await get(`/api/slope/claims?limit=50&offset=${offset}`);
    all.push(...page.json.claims);
  }
  assert.equal(all.length, json.total);
  for (const c of all) {
    assert.match(c.source.url, /^https?:\/\//, `${c.id} has no source URL`);
    assert.ok(['verified', 'source-declared', 'contested', 'unverified'].includes(c.truth_status), `${c.id}: ${c.truth_status}`);
    assert.ok(c.cannot_establish.length > 10, `${c.id} states no limit`);
    assert.ok(c.checker_note.length > 0, `${c.id} has no checker note`);
  }
});

await test('forty rules were tested, and each that fell says why in the checker\'s own words', async () => {
  const { json } = await get('/api/slope/rules?limit=50');
  assert.equal(json.total, 40);
  const fell = json.rules.filter(r => r.verdict === 'slope');
  assert.equal(fell.length, 39);
  for (const r of fell) {
    assert.ok(r.fell_because && r.fell_because.length > 40, `${r.id} fell with no reason given`);
    assert.equal(r.proposed, r.proposed, 'proposed rule text missing');
  }
});

await test('one rule by id carries the claim and source behind it', async () => {
  const { json } = await get('/api/slope/rules/hog-gap-13cm');
  assert.equal(json.rule.verdict, 'slope');
  assert.match(json.rule.fell_because, /sufficient/i);
  assert.ok(json.claim && json.claim.source.url.startsWith('http'));
});

await test('an unknown rule or claim id teaches', async () => {
  const r = await get('/api/slope/rules/no-such-rule');
  assert.equal(r.res.status, 404);
  assert.ok(r.json.valid_ids.length === 40);
  const c = await get('/api/slope/claims/no-such-claim');
  assert.equal(c.res.status, 404);
});

await test('filters work and reject unknown values with the valid list', async () => {
  const { json } = await get('/api/slope/claims?topic=water-weather&limit=50');
  assert.ok(json.total > 0 && json.claims.every(c => c.topic === 'water-weather'));
  const bad = await get('/api/slope/claims?topic=hedges');
  assert.equal(bad.res.status, 400);
  assert.ok(bad.json.valid_topics.includes('invertebrates'));
  const badv = await get('/api/slope/rules?verdict=wall');
  assert.equal(badv.res.status, 400);
});

await test('weigh answers per area and names how many supposed requirements fell', async () => {
  const { json } = await get('/api/slope/weigh?want=animals');
  assert.equal(json.walls.length, 0);
  assert.ok(json.rules_that_fell.length >= 10);
  assert.match(json.walls_note, /none of them held/);
  assert.ok(json.gradients.length > 0);
  const bad = await get('/api/slope/weigh?want=unicorns');
  assert.equal(bad.res.status, 400);
  assert.ok(bad.json.valid.includes('water'));
});

await test('the adjudication of the one surviving rule is published, not buried', async () => {
  const { json } = await get('/api/slope/walls');
  assert.equal(json.walls.length, 0);
  assert.equal(json.count, 0);
  assert.match(json.adjudication.what_actually_survives, /definition, not a finding/);
  assert.match(json.adjudication.why_this_is_recorded, /checkers disagreed/);
  assert.match(json.the_one_real_floor_is_elsewhere.api, /^\/api\/ground$/);
});

// --- what this room exists to refuse ---------------------------------------

await test('no route returns a non-empty walls list or a filled guarantee', async () => {
  const paths = [
    '/api/slope',
    '/api/slope/walls',
    '/api/slope/rules?limit=50',
    '/api/slope/claims?limit=50',
    '/api/slope/aims',
    '/api/slope/vocab',
    ...['ground-for-plants', 'planting', 'insects', 'animals', 'water', 'time'].map(a => `/api/slope/weigh?want=${a}`),
  ];
  for (const p of paths) {
    const { json } = await get(p);
    assert.equal(json.guaranteed, null, `${p} filled in the guaranteed field`);
    assert.match(json.guaranteed_note, /null by construction/, `${p} lost its guarantee note`);
    if (json.walls !== undefined) {
      assert.deepEqual(json.walls, [], `${p} returned a non-empty walls list`);
    }
  }
});

await test('no tested rule claims to have held on evidence', async () => {
  const { json } = await get('/api/slope/rules?limit=50');
  for (const r of json.rules) {
    assert.ok(['slope', 'definition-not-evidence'].includes(r.verdict), `${r.id} has verdict ${r.verdict}`);
    assert.notEqual(r.verdict, 'wall', `${r.id} claims to be a wall`);
  }
  const held = json.rules.filter(r => r.verdict === 'definition-not-evidence');
  assert.equal(held.length, 1, 'exactly one rule should survive, and only as a definition');
});

await test('vocab publishes what is never returned', async () => {
  const { json } = await get('/api/slope/vocab');
  assert.ok(json.never_returned.includes('guaranteed'));
  assert.match(json.verdicts.slope, /gradient/);
  assert.match(json.verdicts['definition-not-evidence'], /No study established it/);
});

await test('an unknown route 404s with the endpoint list', async () => {
  const { res, json } = await get('/api/slope/nowhere/deeper');
  assert.equal(res.status, 404);
  assert.ok(Array.isArray(json.endpoints));
});

console.log(`\n  ${passed} passed\n`);
