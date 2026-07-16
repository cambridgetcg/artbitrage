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

// ── Wave 2-3 ──────────────────────────────────────────────────────
import { onRequestPost } from '../functions/api/trade/[[route]].js';
import { createHash } from 'node:crypto';

async function post(path, body, contentType = 'application/json') {
  const res = await onRequestPost({
    request: new Request(`https://artbitrage.test${path}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env,
  });
  const json = await res.json();
  return { res, json };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value).filter(k => value[k] !== undefined).sort()
      .map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

const SAMPLE_LOT = {
  schema: 'artbitrage.lot/1',
  id: 'demo-0001',
  object: {
    type: 'painting',
    title: 'Bridge at Dusk',
    maker: 'Zhang Daqian',
    date_period: '1965',
    materials: ['ink and color on paper'],
    measurements: [{ dimension: 'height', value: 95, unit: 'cm' }, { dimension: 'width', value: 44.5, unit: 'cm' }],
  },
  heading: { display: 'ZHANG DAQIAN', qualifier_code: 'full-attribution' },
  maker_names: [{ value: '張大千', script: 'Hani' }, { value: 'Zhang Daqian', system: 'pinyin' }],
  estimate: { low: 80000, high: 120000, currency: 'USD' },
  reserve_exists: true,
  lifecycle: 'catalogued',
  provenance: { display_string: 'Private collection, Hong Kong; purchased by the present owner, 1998.' },
};

await test('lots GET serves the frozen contract with CSV door and privacy docs', async () => {
  const { json } = await get('/api/trade/lots');
  assert.equal(json.schema, 'artbitrage.lot/1');
  assert.match(json.csv_door.privacy, /living-party/i);
  assert.equal(json.non_capabilities.persisted, false);
});

await test('lots POST: valid record → 202 witness with recomputable hash', async () => {
  const { res, json } = await post('/api/trade/lots', SAMPLE_LOT);
  assert.equal(res.status, 202);
  assert.equal(json.persisted, false);
  assert.equal(json.record.heading.warranty_bearing, true, 'full-attribution is warranty-bearing per vocab');
  assert.equal(json.record.object.measurements[0].normalized_cm, 95);
  assert.ok(json.record.objectid_core.present.includes('title'));
  assert.ok(json.record.objectid_core.missing.includes('inscriptions'));
  assert.ok(json.record.provenance.events.length === 2, 'provenance display_string auto-parsed');
  const expected = 'sha256:' + createHash('sha256').update(canonicalJson(json.record)).digest('hex');
  assert.equal(json.content_hash, expected, 'hash recomputable from the published canonicalization');
});

await test('lots POST: strict tier rejects — unknown field, bad qualifier, inverted estimate', async () => {
  const bad = { ...SAMPLE_LOT, surprise: true };
  const { res: r1, json: j1 } = await post('/api/trade/lots', bad);
  assert.equal(r1.status, 422);
  assert.ok(j1.issues.some(i => i.code === 'unknown_field'));
  const badQ = { ...SAMPLE_LOT, heading: { display: 'X', qualifier_code: 'definitely-real' } };
  const { json: j2 } = await post('/api/trade/lots', badQ);
  assert.ok(j2.issues.some(i => i.code === 'unknown_qualifier'));
  const badE = { ...SAMPLE_LOT, estimate: { low: 200, high: 100, currency: 'USD' } };
  const { json: j3 } = await post('/api/trade/lots', badE);
  assert.ok(j3.issues.some(i => i.code === 'inverted_range'));
});

await test('lots POST: ivory in materials without compliance_flags warns toward /gates', async () => {
  const ivory = { schema: 'artbitrage.lot/1', object: { type: 'sculpture', title: 'Netsuke', materials: ['carved elephant ivory'] } };
  const { res, json } = await post('/api/trade/lots', ivory);
  assert.equal(res.status, 202);
  assert.ok(json.validation_warnings.some(w => w.code === 'possible_material_gate'));
});

await test('lots POST: CSV door maps Artlogic headers, ignores living-party columns, re-validates strictly', async () => {
  const csv = [
    'Artist,Title,Year,Medium,Dimensions,Stock number,Retail currency,Retail price,Status,Availability,Provenance,Current owner',
    'Bridget Riley,Untitled [Fragment 3],1965,Screenprint on plexiglas,73.7 x 68.6 cm,BR-1965-004,GBP,120000.00,On consignment,Available,"The artist; Private Collection, London",Somebody Private',
    ',,,,,,,,,,,',
  ].join('\r\n');
  const { res, json } = await post('/api/trade/lots', csv, 'text/csv');
  assert.equal(res.status, 202);
  assert.equal(json.csv.rows, 2);
  assert.equal(json.csv.valid, 1);
  const row = json.results[0];
  assert.equal(row.ok, true);
  assert.equal(row.record.object.maker, 'Bridget Riley');
  assert.equal(row.record.estimate.low, 120000);
  assert.equal(row.record.estimate.currency, 'GBP');
  assert.equal(row.record.availability, 'available');
  assert.equal(row.record.object.measurements[0].normalized_cm, 73.7);
  assert.ok(row.mapping_notes.some(n => /living-party privacy/.test(n)), 'Current owner column ignored with a note');
  assert.ok(row.record.provenance.events.length >= 2, 'provenance parsed from CSV cell');
  assert.equal(json.results[1].ok, false, 'empty row fails identification');
});

await test('lots POST: 415 on unsupported content type', async () => {
  const { res } = await post('/api/trade/lots', '<xml/>', 'application/xml');
  assert.equal(res.status, 415);
});

await test('provenance GET publishes the grammar with per-rule verification status', async () => {
  const { json } = await get('/api/trade/provenance');
  assert.equal(json.grammar, 'aam-provenance/1');
  assert.ok(json.rules.some(r => r.status === 'verified-with-variance'), 'bracket variance carried honestly');
});

await test('provenance POST: parses the canonical Art Tracks example (semicolons = direct)', async () => {
  const text = 'Artist estate; Michel Monet, son of the artist, Sorel Moussel, Dept. Eure et Loire, 1926; Walter P. Chrysler, Jr., New York, NY, 1950; purchased by Museum, April 1962.';
  const { res, json } = await post('/api/trade/provenance', { display_string: text });
  assert.equal(res.status, 202);
  assert.equal(json.record.events.length, 4);
  assert.equal(json.record.events[0].party.display, 'Artist estate');
  assert.equal(json.record.events[1].transfer_from_previous, 'direct');
  assert.equal(json.record.events[1].party.relationship, 'son of the artist');
  assert.equal(json.record.events[3].method, 'purchase');
  assert.equal(json.record.events[3].date.year_from, 1962);
  const expected = 'sha256:' + createHash('sha256').update(canonicalJson(json.record)).digest('hex');
  assert.equal(json.content_hash, expected, 'hash preimage is exactly the record field');
});

await test('provenance POST: dealers in parens, footnote/citation markers, inheritance', async () => {
  const text = 'Mrs. Serunian [1][a]; by inheritance to Dr. H. H. Serunian, son of previous, Worcester, Massachusetts [b]; purchased by Freer Gallery of Art, 1937.';
  const { json } = await post('/api/trade/provenance', { display_string: text });
  assert.equal(json.record.events.length, 3, 'honorific periods must not split clauses');
  assert.equal(json.record.events[0].footnote, '1');
  assert.deepEqual(json.record.events[0].citations, ['a']);
  assert.equal(json.record.events[1].method, 'inheritance');
  assert.equal(json.record.events[2].party.display, 'Freer Gallery of Art');
  const dealer = '(Galerie Durand-Ruel, Paris, 1891); John Doe, 1901.';
  const { json: j2 } = await post('/api/trade/provenance', { display_string: dealer });
  assert.equal(j2.record.events[0].party.role, 'dealer-agent-or-auction');
  assert.equal(j2.record.events[1].transfer_from_previous, 'direct');
});

await test('provenance POST: period = not_known_direct; events → display generation', async () => {
  const gap = 'Jane Roe, London, until 1892. Sam Poe, by 1935.';
  const { json } = await post('/api/trade/provenance', { display_string: gap });
  assert.equal(json.record.events.length, 2);
  assert.equal(json.record.events[1].transfer_from_previous, 'not_known_direct');
  const { json: gen } = await post('/api/trade/provenance', { events: [
    { party: { display: 'Jane Roe', role: 'owner' }, location: 'London' },
    { party: { display: 'Sam Poe', role: 'owner' }, transfer_from_previous: 'direct' },
  ] });
  assert.equal(gen.record.display_string, 'Jane Roe, London; Sam Poe.');
  assert.ok(gen.content_hash, 'generate path carries a hash too');
});

await test('results GET: empty corpus stated plainly, contract demands price_basis', async () => {
  const { json } = await get('/api/trade/results');
  assert.equal(json.coverage.sales, 0);
  assert.match(json.coverage.note, /EMPTY/);
  assert.match(json.contract.price_basis, /never inferred/);
});

await test('results POST: valid submission → witness + PR path; basis and price rules enforced', async () => {
  const submission = {
    schema: 'artbitrage.auction-results/1',
    house: 'demo-house',
    sale: { name: 'Summer Sale', location: 'london', date: '2026-07-01', currency: 'GBP' },
    price_basis: 'premium_inclusive',
    lots: [
      { lot_number: '1', outcome: 'sold', price: 12500 },
      { lot_number: '2', outcome: 'bought_in' },
      { lot_number: '3', outcome: 'sold', price_withheld: true },
    ],
  };
  const { res, json } = await post('/api/trade/results', submission);
  assert.equal(res.status, 202);
  assert.equal(json.persisted, false);
  assert.ok(json.next_steps.some(s => /pull request/.test(s)));
  assert.match(json.consideration.what_we_never_do, /Scrape/);
  const expected = 'sha256:' + createHash('sha256').update(canonicalJson(json.record)).digest('hex');
  assert.equal(json.content_hash, expected);

  const noBasis = { ...submission };
  delete noBasis.price_basis;
  const { res: r2, json: j2 } = await post('/api/trade/results', noBasis);
  assert.equal(r2.status, 422);
  assert.ok(j2.issues.some(i => i.path === '$.price_basis'));

  const badLots = { ...submission, lots: [{ lot_number: '1', outcome: 'sold' }, { lot_number: '2', outcome: 'bought_in', price: 100 }] };
  const { json: j3 } = await post('/api/trade/results', badLots);
  assert.ok(j3.issues.some(i => i.path === '$.lots[0].price' && i.code === 'required'));
  assert.ok(j3.issues.some(i => i.path === '$.lots[1].price' && i.code === 'conflict'));
});

await test('review regressions: adversarial event shapes 422 (never 500)', async () => {
  const { res: r1, json: j1 } = await post('/api/trade/provenance', { events: [{ party: { display: 'X' }, period_certainty: 123 }] });
  assert.equal(r1.status, 422);
  assert.ok(j1.issues.length > 0);
  const { res: r2 } = await post('/api/trade/provenance', { events: [{ party: { display: 'X' }, citations: 5 }] });
  assert.equal(r2.status, 422);
  const { res: r3, json: j3 } = await post('/api/trade/provenance', { events: 'nope' });
  assert.equal(r3.status, 422);
  assert.ok(j3.issues.some(i => i.path === '$.events' && i.code === 'wrong_type'), 'present-but-malformed events gets a typed issue');
});

await test('review regressions: circa qualifier, J.P. initials, Inc. boundary', async () => {
  const { json: circa } = await post('/api/trade/provenance', { display_string: 'Private collection, circa 1900.' });
  assert.equal(circa.record.events[0].date.qualifier, 'circa');
  const { json: ca } = await post('/api/trade/provenance', { display_string: 'Private collection, ca. 1900.' });
  assert.equal(ca.record.events[0].date.qualifier, 'circa');
  const { json: jp } = await post('/api/trade/provenance', { display_string: 'Purchased by J.P. Morgan, New York, 1901; by descent to Jack Morgan.' });
  assert.equal(jp.record.events.length, 2, 'J.P. must not split');
  assert.equal(jp.record.events[0].party.display, 'J.P. Morgan');
  const { json: inc } = await post('/api/trade/provenance', { display_string: 'Sold to Duveen Brothers Inc. Acquired by Andrew Mellon.' });
  assert.equal(inc.record.events.length, 2, 'Inc. before a method keyword is a real boundary');
});

await test('review regressions: European decimal-comma price parses correctly or not at all', async () => {
  const csv = 'Title,Retail price,Retail currency\nSunset,"1.234,56",EUR\nDawn,"1,234.56",USD\nNoon,"1.234",EUR';
  const { json } = await post('/api/trade/lots', csv, 'text/csv');
  assert.equal(json.results[0].record.estimate.low, 1234.56, 'European format');
  assert.equal(json.results[1].record.estimate.low, 1234.56, 'UK/US format');
  assert.ok(json.results[0].mapping_notes.some(n => n.includes('parsed as 1234.56')), 'coercion states the parsed value');
  assert.equal(json.results[2].record.estimate.low, 1.23, 'single dot stays decimal, stated in the note');
});

await test('review regressions: quoted-empty CSV row counted; impossible dates rejected; lot_number object rejected', async () => {
  const csv = 'Title\n""\nSunset';
  const { json } = await post('/api/trade/lots', csv, 'text/csv');
  assert.equal(json.csv.rows, 2, 'quoted-empty row must be counted and reported');
  assert.equal(json.results[0].ok, false);
  const badDate = { schema: 'artbitrage.auction-results/1', house: 'h', sale: { name: 'S', date: '2026-13-45', currency: 'GBP' }, price_basis: 'hammer', lots: [{ lot_number: '1', outcome: 'bought_in' }] };
  const { res: rd, json: jd } = await post('/api/trade/results', badDate);
  assert.equal(rd.status, 422);
  assert.ok(jd.issues.some(i => i.path === '$.sale.date'));
  const badLotNo = { ...badDate, sale: { name: 'S', date: '2026-07-01', currency: 'GBP' }, lots: [{ lot_number: { a: 1 }, outcome: 'bought_in' }] };
  const { json: jl } = await post('/api/trade/results', badLotNo);
  assert.ok(jl.issues.some(i => i.path.includes('lot_number') && i.code === 'wrong_type'), 'objects must not launder into "[object Object]"');
});

await test('review regressions: withheld on bought_in rejected; bidi controls rejected; lot events pointed elsewhere', async () => {
  const sub = { schema: 'artbitrage.auction-results/1', house: 'h', sale: { name: 'S', date: '2026-07-01', currency: 'GBP' }, price_basis: 'hammer', lots: [{ lot_number: '1', outcome: 'bought_in', price_withheld: true }] };
  const { res, json } = await post('/api/trade/results', sub);
  assert.equal(res.status, 422);
  assert.ok(json.issues.some(i => i.path.includes('price_withheld')));
  const bidi = { schema: 'artbitrage.lot/1', object: { type: 'painting', title: 'Monet\u202Egnitniap' } };
  const { res: rb, json: jb } = await post('/api/trade/lots', bidi);
  assert.equal(rb.status, 422);
  assert.ok(jb.issues.some(i => i.code === 'formatting_character'));
  const withEvents = { schema: 'artbitrage.lot/1', object: { type: 'painting', title: 'T' }, provenance: { events: [{ party: { display: 'X' } }] } };
  const { res: re, json: je } = await post('/api/trade/lots', withEvents);
  assert.equal(re.status, 422);
  assert.ok(je.issues.some(i => i.code === 'not_accepted_here'));
});

await test('review regressions: GET docs carry no validated claim; results next_steps point at trade.json', async () => {
  const { json: doc } = await get('/api/trade/lots');
  assert.equal(doc.non_capabilities.validated, undefined, 'documentation validated nothing');
  const sub = { schema: 'artbitrage.auction-results/1', house: 'h', sale: { name: 'S', date: '2026-07-01', currency: 'GBP' }, price_basis: 'premium_inclusive', lots: [{ lot_number: '1', outcome: 'sold', price: 100 }] };
  const { json } = await post('/api/trade/results', sub);
  assert.ok(json.next_steps[0].includes('trade.json'), 'persistence path must point at what GET serves');
});

console.log(`\n${passed} trade tests passed${process.exitCode ? ' (with failures)' : ''}`);
