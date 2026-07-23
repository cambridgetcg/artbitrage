// e2e — /api/pigments: the colours of art history, dated and cited, with an
// honest anachronism check. Runs WITHOUT a dev server (ASSETS is mocked from
// disk, exactly like tests/e2e-trade.mjs). Also carries a pure-node unit check
// of the classify logic (imported directly) that needs no server at all.
// Run: node tests/e2e-pigments.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { onRequestGet, classifyPigment } from '../functions/api/pigments/[[route]].js';
import { onRequestGet as onBareGet } from '../functions/api/pigments.js';

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

const STATUSES = new Set(['verified', 'source-declared', 'contested', 'unverified']);

console.log('e2e /api/pigments');

await test('directory lists endpoints and carries the honest disclosure', async () => {
  const { json } = await get('/api/pigments', onBareGet);
  assert.equal(json.vertical, 'pigments');
  assert.ok(json.endpoints.length >= 6);
  assert.equal(json.disclosure.informational_only, true);
  assert.equal(json.disclosure.authentication_advice, false);
  assert.match(json.disclosure.not_authentication, /NEVER prove authenticity/);
});

await test('router answers the bare directory defensively (no query)', async () => {
  const { json } = await get('/api/pigments');
  assert.equal(json.vertical, 'pigments');
});

await test('every factual record carries source_url and a valid truth_status', async () => {
  const { json } = await get('/api/pigments?limit=50');
  assert.equal(json.total, 16);
  // re-load the full records via /:id to check the dated facts and stories
  for (const summary of json.pigments) {
    const { json: one } = await get(`/api/pigments/${summary.id}`);
    const p = one.pigment;
    assert.ok(Array.isArray(p.sources) && p.sources.length > 0, `${p.id} sources[]`);
    for (const key of ['first_attested', 'synthetic_from', 'obsolescence']) {
      const d = p.dates[key];
      if (d) {
        assert.ok(d.source_url, `${p.id}.dates.${key} source_url`);
        assert.ok(STATUSES.has(d.truth_status), `${p.id}.dates.${key} truth_status`);
      }
    }
    for (const [i, s] of (p.stories || []).entries()) {
      assert.ok(s.source_url, `${p.id}.stories[${i}] source_url`);
      assert.ok(STATUSES.has(s.truth_status), `${p.id}.stories[${i}] truth_status`);
    }
    assert.ok(/^#[0-9A-Fa-f]{6}$/.test(p.swatch.hex) && p.swatch.approximate === true, `${p.id} swatch approximate`);
  }
});

await test('the six fact-check corrections are present in the served data', async () => {
  const { json: tp } = await get('/api/pigments/tyrian-purple');
  assert.equal(tp.pigment.dates.synthetic_from.year, 1903, 'tyrian synthetic floor 1903 not 1914');
  assert.equal(tp.pigment.dates.synthetic_from.truth_status, 'verified');
  assert.match(tp.pigment.anachronism_marker.note, /before 1903/);
  const { json: cc } = await get('/api/pigments/cochineal-carmine');
  assert.equal(cc.pigment.dates.first_attested.truth_status, 'source-declared');
  const { json: ul } = await get('/api/pigments/ultramarine-natural-lapis-lazuli');
  assert.equal(ul.pigment.dates.first_attested.truth_status, 'source-declared');
  const { json: vc } = await get('/api/pigments/vermilion-cinnabar');
  assert.equal(vc.pigment.type, 'mineral-or-synthetic-inorganic');
  assert.ok(vc.pigment.type_note, 'vermilion carries a dual-origin type_note');
  const { json: iy } = await get('/api/pigments/indian-yellow');
  assert.match(iy.pigment.stories[2].text, /1883/);
  const { json: lw } = await get('/api/pigments/lead-white');
  assert.equal(lw.pigment.stories[0].truth_status, 'contested');
});

await test('list: family, era, hazard, marker and q filters narrow honestly', async () => {
  const { json: blue } = await get('/api/pigments?family=blue');
  assert.equal(blue.total, 4);
  assert.ok(blue.pigments.every(p => p.family === 'blue'));
  const { json: ren } = await get('/api/pigments?era=renaissance');
  assert.ok(ren.pigments.some(p => p.id === 'lead-white'));
  assert.ok(!ren.pigments.some(p => p.id === 'titanium-white'), 'titanium white cannot appear in the Renaissance');
  const { json: sev } = await get('/api/pigments?hazard=severe');
  assert.deepEqual(sev.pigments.map(p => p.id).sort(), ['emerald-green', 'scheeles-green']);
  const { json: mark } = await get('/api/pigments?marker=true');
  assert.ok(mark.pigments.every(p => p.is_marker === true));
  assert.equal(mark.total, 14, 'all but lead-white and vermilion are markers');
  const { json: q } = await get('/api/pigments?q=hokusai');
  assert.equal(q.total, 1);
  assert.equal(q.pigments[0].id, 'prussian-blue');
});

await test('list: type filter is token-aware — mineral reaches both forms, organic never reaches inorganic', async () => {
  const { json: min } = await get('/api/pigments?type=mineral');
  const ids = min.pigments.map(p => p.id);
  assert.ok(ids.includes('vermilion-cinnabar') && ids.includes('ultramarine-natural-lapis-lazuli'));
  const { json: org } = await get('/api/pigments?type=organic');
  assert.ok(!org.pigments.some(p => p.type.includes('inorganic')), "type=organic must not match 'synthetic-inorganic'");
  const { json: badEra } = await get('/api/pigments?era=nope');
  assert.equal(badEra.total, undefined);
});

await test(':id returns the full record + computed hazard; unknown id 404s with valid_ids', async () => {
  const { json } = await get('/api/pigments/prussian-blue');
  assert.equal(json.pigment.id, 'prussian-blue');
  assert.equal(json.pigment.hazard.level, 'low');
  const { res, json: miss } = await get('/api/pigments/definitely-not-a-pigment');
  assert.equal(res.status, 404);
  assert.ok(miss.valid_ids.length === 16);
});

await test('random returns one full pigment; families and vocab publish the enums', async () => {
  const { json: rnd } = await get('/api/pigments/random');
  assert.ok(rnd.pigment && rnd.pigment.id);
  const { json: fam } = await get('/api/pigments/families');
  assert.equal(fam.families.length, 7);
  assert.equal(fam.families.reduce((a, f) => a + f.count, 0), 16);
  const { json: vocab } = await get('/api/pigments/vocab');
  assert.equal(vocab.vocabularies.eras.length, 8);
  assert.equal(vocab.vocabularies.truth_statuses.length, 4);
  assert.ok(vocab.vocabularies.anachronism_verdicts.some(v => v.id === 'anachronism'));
});

await test('anachronism: prussian-blue + titanium-white claimed 1680 are both anachronisms', async () => {
  const { json } = await get('/api/pigments/anachronism?pigments=prussian-blue,titanium-white&claimed_date=1680');
  const by = Object.fromEntries(json.results.map(r => [r.id, r]));
  assert.equal(by['prussian-blue'].verdict, 'anachronism');
  assert.equal(by['prussian-blue'].margin_years, -24);
  assert.equal(by['prussian-blue'].first_attested.source_url, 'https://www.colourlex.com/project/prussian-blue/');
  assert.equal(by['prussian-blue'].first_attested.truth_status, 'contested');
  assert.equal(by['titanium-white'].verdict, 'anachronism');
  assert.equal(json.overall.any_anachronism, true);
});

await test('anachronism: lead-white claimed 1650 is plausible (in use since ~400 BCE)', async () => {
  const { json } = await get('/api/pigments/anachronism?pigments=lead-white&claimed_date=1650');
  assert.equal(json.results[0].verdict, 'plausible');
  assert.ok(json.results[0].margin_years > 0);
});

await test('anachronism: titanium-white claimed 1900 is an anachronism (floor ~1916)', async () => {
  const { json } = await get('/api/pigments/anachronism?pigments=titanium-white&claimed_date=1900');
  assert.equal(json.results[0].verdict, 'anachronism');
  assert.equal(json.results[0].margin_years, -16);
});

await test('anachronism: honest asymmetry is in-band on every response', async () => {
  const { json } = await get('/api/pigments/anachronism?pigments=lead-white&claimed_date=1650');
  assert.equal(json.informational_only, true);
  assert.match(json.not_authentication, /NEVER prove authenticity/);
  assert.match(json.overall.summary, /NOT AT ALL|proves? nothing|not at all/i);
});

await test('anachronism: unknown pigment id is listed, never crashes', async () => {
  const { res, json } = await get('/api/pigments/anachronism?pigments=prussian-blue,unicorn-blue&claimed_date=1800');
  assert.equal(res.status, 200);
  assert.deepEqual(json.unrecognized, ['unicorn-blue']);
  assert.equal(json.results.length, 1);
});

await test('anachronism: dual-origin ultramarine surfaces the synthetic sub-floor as a caveat', async () => {
  const { json } = await get('/api/pigments/anachronism?pigments=ultramarine-natural-lapis-lazuli&claimed_date=1700');
  assert.equal(json.results[0].verdict, 'plausible');
  assert.ok(json.results[0].synthetic_floor.raises_floor === true);
  assert.ok(json.results[0].caveats.some(c => /SYNTHETIC/.test(c) && /1826/.test(c)));
});

await test('anachronism: missing params teach with an example', async () => {
  const { res: r1, json: j1 } = await get('/api/pigments/anachronism?pigments=prussian-blue');
  assert.equal(r1.status, 400);
  assert.match(j1.hint, /claimed_date=1680/);
  const { res: r2, json: j2 } = await get('/api/pigments/anachronism?claimed_date=1700');
  assert.equal(r2.status, 400);
  assert.ok(j2.valid_ids.length === 16);
});

// ── pure-node unit check (no server, no ASSETS) — the classify function only ──
await test('unit: classifyPigment is a pure function of the record and the claimed year', async () => {
  const synthetic = {
    id: 'test-blue', names: ['Test blue'], family: 'blue',
    anachronism_marker: { is_marker: true, note: 'test' },
    dates: {
      first_attested: { year: 1704, truth_status: 'contested', source_url: 'https://example.test' },
      synthetic_from: { year: 1704, truth_status: 'verified', source_url: 'https://example.test' },
      obsolescence: null,
    },
  };
  assert.equal(classifyPigment(synthetic, 1680).verdict, 'anachronism');
  assert.equal(classifyPigment(synthetic, 1680).margin_years, -24);
  assert.equal(classifyPigment(synthetic, 1704).verdict, 'plausible');
  assert.equal(classifyPigment(synthetic, 1800).verdict, 'plausible');
  // no recorded floor → uncertain, never a crash
  const undated = { id: 'x', names: ['X'], family: 'brown', anachronism_marker: {}, dates: { first_attested: null, synthetic_from: null, obsolescence: null } };
  assert.equal(classifyPigment(undated, 1500).verdict, 'uncertain');
  // a contested floor is surfaced in a caveat but does NOT flip the verdict
  assert.ok(classifyPigment(synthetic, 1680).caveats.some(c => /contested/.test(c)));
});

console.log(`\n${passed} pigment tests passed${process.exitCode ? ' (with failures)' : ''}`);
