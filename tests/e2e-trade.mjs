// e2e — /api/trade: reference & computation for auction houses and galleries
// Run: node tests/e2e-trade.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { onRequestGet } from '../functions/api/trade/[[route]].js';
import { onRequestGet as onDirectoryGet } from '../functions/api/trade.js';

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

async function get(path) {
  const res = await onRequestGet({ request: new Request(`https://artbitrage.test${path}`), env });
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

console.log('e2e /api/trade');

await test('directory lists all endpoints and carries the disclosure', async () => {
  const res = await onDirectoryGet();
  const json = await res.json();
  assert.equal(json.vertical, 'trade');
  assert.ok(json.endpoints.length >= 8);
  assert.equal(json.disclosure.informational_only, true);
  assert.equal(json.disclosure.legal_advice, false);
});

await test('router answers the bare directory defensively', async () => {
  const { json } = await get('/api/trade');
  assert.equal(json.vertical, 'trade');
});

await test('fees: every schedule carries source_url, status, and effective_from', async () => {
  const { res, json } = await get('/api/trade/fees');
  assert.equal(res.status, 200);
  assert.ok(json.count > 0, 'expected at least one fee schedule');
  for (const s of json.schedules) {
    assert.ok(s.source_url, `${s.id} missing source_url`);
    assert.ok(['verified', 'source-declared', 'contested', 'unverified'].includes(s.status), `${s.id} bad status`);
    assert.ok(s.effective_from, `${s.id} missing effective_from`);
    assert.ok(Array.isArray(s.bands) && s.bands.length > 0, `${s.id} missing bands`);
  }
});

await test('fees: house filter narrows and as_of respects effective windows', async () => {
  const { json: all } = await get('/api/trade/fees');
  const house = all.schedules[0].house;
  const { json } = await get(`/api/trade/fees?house=${house}`);
  assert.ok(json.count >= 1);
  assert.ok(json.schedules.every(s => s.house === house));
  const { json: past } = await get('/api/trade/fees?as_of=1990-01-01');
  assert.equal(past.count, 0, 'no schedule should be in force in 1990');
});

await test('fees/compute: marginal band math is correct on a known schedule', async () => {
  const { json: all } = await get('/api/trade/fees');
  const s = all.schedules.find(x => x.bands.length >= 2);
  assert.ok(s, 'need a banded schedule to test');
  // hammer exactly at the first band ceiling: premium = ceiling * rate0
  const ceiling = s.bands[0].up_to;
  const { json } = await get(`/api/trade/fees/compute?hammer=${ceiling}&house=${s.house}&location=${s.location}&category=${s.category}&as_of=${s.effective_from}`);
  assert.equal(json.schedule_applied.id, s.id);
  const expected = Math.round(ceiling * s.bands[0].rate * 100) / 100;
  assert.equal(json.buyers_premium, expected);
  assert.equal(json.total_incl_premium, Math.round((ceiling + expected) * 100) / 100);
  // hammer above the ceiling adds the second band on the portion only
  const over = ceiling * 2;
  const { json: j2 } = await get(`/api/trade/fees/compute?hammer=${over}&house=${s.house}&location=${s.location}&category=${s.category}&as_of=${s.effective_from}`);
  const band1 = s.bands[1];
  const portion = Math.min(over, band1.up_to == null ? Infinity : band1.up_to) - band1.over;
  const expected2 = Math.round((ceiling * s.bands[0].rate + portion * band1.rate) * 100) / 100;
  assert.equal(j2.buyers_premium, expected2);
  assert.ok(j2.not_included.length > 0, 'not_included must be explicit');
});

await test('fees/compute: teaching errors — missing house, unknown house, currency mismatch', async () => {
  const { res: r1, json: j1 } = await get('/api/trade/fees/compute?hammer=1000');
  assert.equal(r1.status, 400);
  assert.ok(j1.valid_houses.length > 0);
  const { res: r2, json: j2 } = await get('/api/trade/fees/compute?hammer=1000&house=nonexistent');
  assert.equal(r2.status, 404);
  assert.ok(j2.valid_houses);
  const { json: all } = await get('/api/trade/fees');
  const s = all.schedules[0];
  const wrong = s.currency === 'USD' ? 'GBP' : 'USD';
  const { res: r3, json: j3 } = await get(`/api/trade/fees/compute?hammer=1000&house=${s.house}&location=${s.location}&category=${s.category}&currency=${wrong}&as_of=${s.effective_from}`);
  assert.equal(r3.status, 400);
  assert.match(j3.error, /currency mismatch/);
});

await test('arr (UK, GBP basis since 2024-04-01): bands, threshold, cap, out-of-term', async () => {
  // £80,000: 4% of £50,000 + 3% of £30,000 = £2,000 + £900 = £2,900
  const { json } = await get('/api/trade/arr?price=80000&currency=GBP');
  assert.equal(json.currency, 'GBP');
  assert.equal(json.royalty, 2900);
  assert.equal(json.cap_applied, false);
  assert.ok(json.collecting_societies.includes('DACS'));
  assert.equal(json.disclosure.informational_only, true);
  // below the £1,000 threshold
  const { json: low } = await get('/api/trade/arr?price=500&currency=GBP');
  assert.equal(low.royalty, 0);
  // gov.uk worked example: £200,000 sale → £6,500
  const { json: govuk } = await get('/api/trade/arr?price=200000&currency=GBP');
  assert.equal(govuk.royalty, 6500);
  // the cap is reached at exactly £2,000,000 (royalty = £12,500, not exceeded)
  const { json: at } = await get('/api/trade/arr?price=2000000&currency=GBP');
  assert.equal(at.royalty, 12500);
  assert.equal(at.cap_applied, false);
  // £3,000,000 uncapped = £15,000 → capped at £12,500
  const { json: big } = await get('/api/trade/arr?price=3000000&currency=GBP');
  assert.equal(big.royalty, big.cap);
  assert.equal(big.cap_applied, true);
  // out of term
  const { json: old } = await get('/api/trade/arr?price=80000&currency=GBP&sale_date=2026-07-16&artist_death_year=1900');
  assert.equal(old.royalty, 0);
  assert.equal(old.eligibility.in_scope, false);
});

await test('arr: wrong currency teaches the basis; France runs on EUR with a €750 threshold', async () => {
  const { res, json } = await get('/api/trade/arr?price=80000&currency=EUR');
  assert.equal(res.status, 400);
  assert.match(json.hint, /sterling|GBP/);
  const { json: fr } = await get('/api/trade/arr?price=80000&currency=EUR&jurisdiction=france');
  assert.equal(fr.currency, 'EUR');
  assert.equal(fr.royalty, 2900);
  // €800 sits between the French €750 threshold and the UK £1,000 one: France charges 4% × 800 = €32
  const { json: frMid } = await get('/api/trade/arr?price=800&currency=EUR&jurisdiction=france');
  assert.equal(frMid.royalty, 32);
  const { json: frLow } = await get('/api/trade/arr?price=700&currency=EUR&jurisdiction=france');
  assert.equal(frLow.royalty, 0);
});

await test('thresholds: filterable, every record cites a source', async () => {
  const { json } = await get('/api/trade/thresholds');
  assert.ok(json.count > 0);
  for (const t of json.thresholds) {
    assert.ok(t.source_url, `${t.id} missing source_url`);
    assert.ok(t.kind, `${t.id} missing kind`);
  }
  const { json: uk } = await get('/api/trade/thresholds?jurisdiction=uk');
  assert.ok(uk.thresholds.every(t => t.jurisdiction === 'uk'));
});

await test('gates: an 1890 ivory-inlaid object headed abroad crosses the right gates', async () => {
  const { json } = await get('/api/trade/gates?year=1890&value=200000&currency=GBP&jurisdiction=uk&materials=ivory_elephant');
  assert.ok(json.gates.length >= 3, 'expected several gates');
  const ivory = json.gates.find(g => g.id === 'material-elephant-ivory');
  assert.ok(ivory, 'ivory alias should resolve to elephant-ivory');
  assert.equal(ivory.triggered, true);
  assert.ok(ivory.source_url);
  assert.ok(ivory.fees.some(f => f.amount_gbp === 250), 'exemption certificate fee should surface');
  const aml = json.gates.find(g => g.name.includes('AML'));
  assert.ok(aml && aml.triggered === true, 'AML CDD should trigger at £200,000');
  const exportGate = json.gates.find(g => g.name === 'Export licence');
  assert.ok(exportGate && exportGate.triggered === 'depends', 'export gate needs a category to resolve');
});

await test('gates: a young object triggers no export gate; unknown material teaches', async () => {
  const { json } = await get('/api/trade/gates?year=2020&value=100&currency=EUR&jurisdiction=uk');
  const exportGate = json.gates.find(g => g.name === 'Export licence');
  assert.ok(!exportGate || exportGate.triggered === false);
  const { json: um } = await get('/api/trade/gates?year=1890&materials=unobtainium');
  const gate = um.gates.find(g => g.id === 'material-unobtainium');
  assert.equal(gate.triggered, 'depends');
  assert.ok(gate.valid_materials.length > 0);
});

await test('gates: red coral honestly does not trigger (not CITES-listed); aliases resolve', async () => {
  const { json } = await get('/api/trade/gates?year=1900&materials=coral,scrimshaw');
  const coral = json.gates.find(g => g.id === 'material-red-coral');
  assert.ok(coral, 'coral alias should resolve to red-coral');
  assert.equal(coral.triggered, false);
  const scrimshaw = json.gates.find(g => g.id === 'material-whale-ivory-scrimshaw');
  assert.ok(scrimshaw, 'scrimshaw alias should resolve');
  assert.equal(scrimshaw.triggered, true);
});

await test('gates: UK AML trigger is sterling since 2026-06-30 (SI 2026/621)', async () => {
  const { json } = await get('/api/trade/gates?year=1980&value=10000&currency=GBP&jurisdiction=uk');
  const aml = json.gates.find(g => g.name.includes('AML'));
  assert.equal(aml.triggered, true, '£10,000 exactly meets the UK trigger');
  const { json: eur } = await get('/api/trade/gates?year=1980&value=10000&currency=EUR&jurisdiction=uk');
  const amlEur = eur.gates.find(g => g.name.includes('AML'));
  assert.equal(amlEur.triggered, 'depends', 'EUR value against the GBP trigger must not pretend certainty');
});

await test('vocab: index lists vocabularies; heading ladder carries warranty flags', async () => {
  const { json } = await get('/api/trade/vocab');
  assert.ok(json.vocabularies.length >= 5);
  const { json: ladder } = await get('/api/trade/vocab/heading-qualifiers');
  assert.ok(ladder.terms.length >= 5);
  assert.ok(ladder.terms.some(t => t.warranty_bearing === true));
  assert.ok(ladder.terms.some(t => t.warranty_bearing === false));
  const { res, json: missing } = await get('/api/trade/vocab/nope');
  assert.equal(res.status, 404);
  assert.ok(missing.valid_ids.length > 0);
});

await test('unknown route 404s with the endpoint map', async () => {
  const { res, json } = await get('/api/trade/nonsense');
  assert.equal(res.status, 404);
  assert.ok(json.endpoints.length > 0);
});

console.log(`\n${passed} trade tests passed${process.exitCode ? ' (with failures)' : ''}`);
