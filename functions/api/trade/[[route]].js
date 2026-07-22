// ARTBITRAGE /api/trade/* — the trade vertical, served from trade.json
// Reference & computation for auction houses and galleries.
// Position (TRADE-MODULE.md): Artlogic manages; artbitrage speaks.
// The bare directory (GET /api/trade) is handled by functions/api/trade.js,
// but this router answers it too in case routing sends it here.

const VERTICAL = 'trade';
const TITLE = 'Trade — reference & computation for auction houses and galleries';
const ESSENCE = 'Artlogic manages; artbitrage speaks. No keys, no database, no funds, no take-rate.';

const DISCLOSURE = Object.freeze({
  informational_only: true,
  legal_advice: false,
  note: 'Reference arithmetic over cited public schedules. Confirm against the primary source before invoicing. Never legal, tax, or valuation advice.',
});

const ENDPOINTS = [
  { method: 'GET', path: '/api/trade', desc: 'This directory' },
  { method: 'GET', path: '/api/trade/fees', desc: "Buyer's-premium schedules with effective dates and source citations", params: 'house, location, category, as_of' },
  { method: 'GET', path: '/api/trade/fees/compute', desc: 'All-in buyer cost: marginal band math, line items, schedule_applied, explicit not_included', params: 'hammer, currency, house, location, category, as_of, display_in' },
  { method: 'GET', path: '/api/trade/rates', desc: 'The baked FX MoneyFacts behind display_in — ECB reference rates as cited facts (source, recompute recipe, staleness), from the MONEYWORLD info layer', params: '' },
  { method: 'GET', path: '/api/trade/arr', desc: "Artist's Resale Right royalty: cumulative bands, cap status, liable society", params: 'price, currency=EUR, sale_date, artist_death_year, jurisdiction' },
  { method: 'GET', path: '/api/trade/thresholds', desc: 'Dated compliance constants (AML, export, import, VAT) with source_url per entry', params: 'jurisdiction, kind' },
  { method: 'GET', path: '/api/trade/gates', desc: 'Does this object cross a licensing/compliance gate — one call, each gate citing its regulation', params: 'year, value, currency, jurisdiction, materials, category' },
  { method: 'GET', path: '/api/trade/vocab', desc: 'Trade vocabularies: lot lifecycle, settlement status, heading-qualifier ladder, catalogue symbols, gallery availability' },
  { method: 'GET', path: '/api/trade/vocab/:id', desc: 'One vocabulary by id, e.g. /api/trade/vocab/heading-qualifiers' },
  { method: 'GET', path: '/api/trade/lots', desc: 'The frozen artbitrage.lot/1 contract: fields, enums, CSV door documentation' },
  { method: 'POST', path: '/api/trade/lots', desc: 'Validate lot records — application/json (one record) or text/csv (Artlogic-vocabulary fuzzy header mapping, then strict re-validation); echoes normalized records with content_hash; never stores' },
  { method: 'GET', path: '/api/trade/provenance', desc: 'The versioned aam-provenance/1 grammar: punctuation semantics with per-rule verification status' },
  { method: 'POST', path: '/api/trade/provenance', desc: 'Round-trip: {display_string} → parsed artbitrage.provenance-chain/1 events, or {events} → generated display string; never stores' },
  { method: 'GET', path: '/api/trade/results', desc: 'The voluntary results corpus with an honest coverage matrix — thin stated plainly, never fake-full' },
  { method: 'POST', path: '/api/trade/results', desc: 'Validate a results submission (price_basis required — houses publish premium-inclusive), receive an unsigned witness receipt and the pull-request persistence path' },
];

// ── Wave 2-3 schema constants ─────────────────────────────────────
const LOT_SCHEMA = 'artbitrage.lot/1';
const PROV_SCHEMA = 'artbitrage.provenance-chain/1';
const RESULTS_SCHEMA = 'artbitrage.auction-results/1';
const PROV_GRAMMAR = 'aam-provenance/1';
// Reused deliberately: the canonicalization spec is already published at
// /api/answering-rhymes/statements and receipts must be recomputable anywhere.
const TRADE_CANONICALIZATION = 'answering-rhyme.canonical-json/1';
const TRADE_WITNESS_SCHEMA = 'artbitrage.trade-witness/1';
const TRADE_ERROR_SCHEMA = 'artbitrage.trade-error/1';
const MAX_JSON_BYTES = 65536;
const MAX_CSV_BYTES = 262144;
const MAX_CSV_ROWS = 200;
const MAX_RESULT_LOTS = 500;
const PRICE_BASES = new Set(['hammer', 'premium_inclusive']);
const LOT_OUTCOMES = new Set(['sold', 'bought_in', 'withdrawn', 'post_sale_sold']);
const CURRENCY_RE = /^[A-Z]{3}$/;
const LENGTH_UNITS = { cm: 1, mm: 0.1, m: 100, in: 2.54, ft: 30.48 };
const WEIGHT_UNITS = new Set(['kg', 'g', 'lb']);

// Embedded trade data — loaded once per isolate from trade.json
let TRADE = null;

async function loadTrade(env, request) {
  if (TRADE) return TRADE;
  try {
    const assetUrl = new URL('/trade.json', request.url);
    const res = await env.ASSETS.fetch(assetUrl);
    if (res.ok) {
      TRADE = await res.json();
      return TRADE;
    }
  } catch (e) {
    try {
      const res2 = await fetch(new URL('/trade.json', request.url));
      if (res2.ok) {
        TRADE = await res2.json();
        return TRADE;
      }
    } catch (e2) {}
  }
  return TRADE;
}

// Baked FX facts (rates.json, produced by tools/bake-rates.mjs from a local
// MONEYWORLD node). Absent file → doors that need it refuse with the recipe.
let RATES = null;

async function loadRates(env, request) {
  if (RATES) return RATES;
  try {
    const res = await env.ASSETS.fetch(new URL('/rates.json', request.url));
    if (res.ok) { RATES = await res.json(); return RATES; }
  } catch (e) {}
  return RATES;
}

function jsonResponse(data, status = 200, cacheSeconds = 0) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (cacheSeconds > 0) headers['Cache-Control'] = `public, max-age=${cacheSeconds}`;
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}

function safeString(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

function parseMoney(value) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e12) return null;
  return n;
}

function parseYear(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < -10000 || n > 3000) return null;
  return n;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Shape AND calendar validity — 2026-13-45 must not reach a receipt or filename.
function isRealDate(s) {
  if (!ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= days[m - 1];
}

function parseIsoDate(value, fallback) {
  const s = safeString(value, 10);
  if (!s) return fallback;
  return isRealDate(s) ? s : null;
}

function todayIso(request) {
  // Workers give a stable Date per request start; good enough for as_of defaults
  return new Date().toISOString().slice(0, 10);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function directoryResponse() {
  return jsonResponse({ vertical: VERTICAL, title: TITLE, essence: ESSENCE, disclosure: DISCLOSURE, endpoints: ENDPOINTS }, 200, 3600);
}

// ── schedule selection ────────────────────────────────────────────
// A schedule is in force on as_of when effective_from <= as_of and
// (effective_to is null or as_of < effective_to). Latest effective_from wins.
function schedulesInForce(schedules, { house, location, category, as_of }) {
  return (schedules || [])
    .filter(s => (!house || s.house === house)
      && (!location || s.location === location)
      && (!category || s.category === category)
      && (!s.effective_from || s.effective_from <= as_of)
      && (!s.effective_to || as_of < s.effective_to))
    .sort((a, b) => String(b.effective_from || '').localeCompare(String(a.effective_from || '')));
}

// ── marginal band math ────────────────────────────────────────────
// bands: [{over, up_to|null, rate}] — rate applies to the portion of the
// amount between over and up_to. This is how the majors' premiums work.
function applyBands(amount, bands) {
  const items = [];
  let total = 0;
  for (const band of bands || []) {
    const floor = band.over || 0;
    const ceiling = band.up_to == null ? Infinity : band.up_to;
    if (amount <= floor) continue;
    const portion = Math.min(amount, ceiling) - floor;
    const charge = round2(portion * band.rate);
    items.push({
      band: { over: floor, up_to: band.up_to == null ? null : band.up_to, rate: band.rate },
      portion: round2(portion),
      charge,
    });
    total += charge;
  }
  return { items, total: round2(total) };
}

function scheduleRef(s) {
  return {
    id: s.id,
    house: s.house,
    location: s.location,
    category: s.category,
    effective_from: s.effective_from || null,
    effective_to: s.effective_to || null,
    status: s.status,
    source_url: s.source_url,
    verified_at: s.verified_at || null,
  };
}

// ── route handlers ────────────────────────────────────────────────

function handleFees(trade, q, request) {
  const as_of = parseIsoDate(q.as_of, todayIso(request));
  if (as_of === null) return jsonResponse({ error: 'as_of must be an ISO date', hint: 'GET /api/trade/fees?house=sothebys&as_of=2026-07-16' }, 400);
  const house = safeString(q.house, 60).toLowerCase();
  const location = safeString(q.location, 60).toLowerCase();
  const category = safeString(q.category, 60).toLowerCase();
  const matched = schedulesInForce(trade.fee_schedules, { house, location, category, as_of });
  return jsonResponse({
    schema: 'artbitrage.fee-schedule/1',
    as_of,
    count: matched.length,
    schedules: matched,
    houses: [...new Set((trade.fee_schedules || []).map(s => s.house))],
    disclosure: DISCLOSURE,
  }, 200, 3600);
}

function handleFeesCompute(trade, rates, q, request) {
  const hammer = parseMoney(q.hammer);
  if (hammer === null) return jsonResponse({ error: 'hammer is required and must be a non-negative number', hint: 'GET /api/trade/fees/compute?hammer=100000&currency=USD&house=sothebys&location=new-york' }, 400);
  const house = safeString(q.house, 60).toLowerCase();
  if (!house) return jsonResponse({ error: 'house is required', valid_houses: [...new Set((trade.fee_schedules || []).map(s => s.house))] }, 400);
  const as_of = parseIsoDate(q.as_of, todayIso(request));
  if (as_of === null) return jsonResponse({ error: 'as_of must be an ISO date (YYYY-MM-DD)' }, 400);
  const location = safeString(q.location, 60).toLowerCase();
  const category = safeString(q.category, 60).toLowerCase() || 'standard';

  let matched = schedulesInForce(trade.fee_schedules, { house, location, category, as_of });
  if (matched.length === 0) {
    const forHouse = (trade.fee_schedules || []).filter(s => s.house === house);
    if (forHouse.length === 0) {
      return jsonResponse({ error: 'unknown house', house, valid_houses: [...new Set((trade.fee_schedules || []).map(s => s.house))] }, 404);
    }
    return jsonResponse({
      error: 'no schedule in force for that house/location/category on that date',
      house, location: location || null, category, as_of,
      valid_locations: [...new Set(forHouse.map(s => s.location))],
      valid_categories: [...new Set(forHouse.map(s => s.category))],
      hint: 'add ?location= — salesrooms carry different bands and currencies',
    }, 404);
  }
  if (!location) {
    const locations = [...new Set(matched.map(s => s.location))];
    if (locations.length > 1) {
      return jsonResponse({
        error: 'location is required for this house — salesrooms carry different bands and currencies',
        house, valid_locations: locations,
        hint: 'GET /api/trade/fees/compute?hammer=100000&currency=USD&house=' + house + '&location=' + locations[0],
      }, 400);
    }
  }
  const schedule = matched[0];

  const currency = safeString(q.currency, 8).toUpperCase();
  if (currency && currency !== schedule.currency) {
    return jsonResponse({
      error: `currency mismatch: the ${schedule.house} ${schedule.location} schedule is denominated in ${schedule.currency}`,
      requested: currency,
      hint: 'pass hammer in the salesroom currency — or add display_in=' + currency + ' for a cited reference-rate conversion alongside the salesroom numbers',
    }, 400);
  }

  const premium = applyBands(hammer, schedule.bands);
  const notIncluded = [
    ...(schedule.extras || []).map(x => ({
      name: x.name, basis: x.basis || null, rate: x.rate ?? null, status: x.status,
      note: 'listed by the source but not added to this total — verify before invoicing',
    })),
    { name: 'sales tax / VAT', note: 'jurisdiction- and buyer-specific; see /api/trade/thresholds?kind=vat' },
    { name: "artist's resale right", note: 'may apply on qualifying resales; see /api/trade/arr' },
    { name: 'shipping, storage, loss/damage liability', note: 'house- and lot-specific' },
  ];

  // display_in: a cited reference-rate conversion ALONGSIDE the salesroom
  // numbers, never replacing them. The rate travels as a full MoneyFact —
  // source, recompute recipe, and its own staleness, honestly surfaced even
  // though the fact was baked at build time (consumer #1 of MONEYWORLD).
  const displayIn = safeString(q.display_in, 8).toUpperCase();
  let display = null;
  if (displayIn && displayIn !== schedule.currency) {
    if (!rates || !Array.isArray(rates.facts)) {
      return jsonResponse({
        error: 'display_in unavailable: no baked rates on this deployment',
        hint: 'bake with `node tools/bake-rates.mjs` (needs a local MONEYWORLD node); GET /api/trade/rates for provenance',
      }, 503);
    }
    const fact = rates.facts.find(f => f.subject === `fiat:iso4217/${schedule.currency}` && f.unit === `fiat:iso4217/${displayIn}`);
    if (!fact) {
      return jsonResponse({
        error: `no baked rate for ${schedule.currency}→${displayIn}`,
        baked_currencies: [...new Set(rates.facts.map(f => f.unit.split('/').pop()))].sort(),
        hint: 'GET /api/trade/rates for everything baked',
      }, 422);
    }
    const rate = Number(fact.value) / 10 ** fact.decimals; // display-layer arithmetic, declared below
    const conv = x => round2(x * rate);
    const ageSeconds = (Date.now() - Date.parse(fact.observed_at)) / 1000;
    display = {
      currency: displayIn,
      converted: {
        hammer: conv(hammer),
        buyers_premium: conv(premium.total),
        total_incl_premium: conv(hammer + premium.total),
      },
      rate: { exact_scaled: fact.value, decimals: fact.decimals },
      rate_fact: fact,
      rate_stale: ageSeconds > fact.stale_after_s,
      note: 'ECB reference-rate arithmetic over a baked, cited fact — never a tradeable quote; amounts remain payable in ' + schedule.currency + '. Conversion applied at display precision (round2); the exact rate is exact_scaled × 10^-' + fact.decimals + '.',
    };
  }

  return jsonResponse({
    schema: 'artbitrage.fee-computation/1',
    input: { hammer, currency: schedule.currency, house, location: schedule.location, category, as_of },
    schedule_applied: scheduleRef(schedule),
    line_items: premium.items,
    buyers_premium: premium.total,
    total_incl_premium: round2(hammer + premium.total),
    ...(display ? { display } : {}),
    not_included: notIncluded,
    disclosure: DISCLOSURE,
  }, 200, 300);
}

// ── rates: the baked facts themselves, provenance-first ──
function handleRates(rates) {
  if (!rates || !Array.isArray(rates.facts)) {
    return jsonResponse({
      error: 'no rates baked on this deployment',
      hint: 'node tools/bake-rates.mjs (needs a local MONEYWORLD node on 127.0.0.1:4747 — github.com/cambridgetcg/cashloom)',
    }, 503);
  }
  return jsonResponse({
    schema: rates.schema,
    baked_at: rates.baked_at,
    generated_by: rates.generated_by,
    note: rates.note,
    count: rates.count,
    facts: rates.facts,
    disclosure: DISCLOSURE,
  }, 200, 3600);
}

// ── ARR: cumulative bands over the regime's own currency, capped ──
// Verified 2026-07-16: the UK basis is GBP since 2024-04-01 (SI 2023/1285,
// ECB conversion abolished for contracts on/after that date); France is EUR.
function handleArr(trade, q, request) {
  const jurisdiction = safeString(q.jurisdiction, 20).toLowerCase() || 'uk';
  const record = (trade.arr || []).find(r => r.jurisdiction === jurisdiction);
  if (!record) {
    return jsonResponse({ error: 'unknown jurisdiction for ARR', jurisdiction, valid_jurisdictions: (trade.arr || []).map(r => r.jurisdiction) }, 404);
  }
  const basis = record.currency_basis;
  const price = parseMoney(q.price);
  if (price === null) return jsonResponse({ error: 'price is required and must be a non-negative number', hint: `GET /api/trade/arr?price=80000&currency=${basis}&artist_death_year=1985&jurisdiction=${jurisdiction}` }, 400);
  const currency = safeString(q.currency, 8).toUpperCase() || basis;
  if (currency !== basis) {
    return jsonResponse({
      error: `ARR bands for ${jurisdiction} are denominated in ${basis}`,
      requested: currency,
      hint: jurisdiction === 'uk'
        ? 'since 2024-04-01 the UK regulations use sterling directly (SI 2023/1285) — pass the sale price in GBP; contracts dated before 2024-04-01 used the old EUR basis converted at the European Central Bank reference rate'
        : `convert the sale price to ${basis} (the European Central Bank reference rate on the contract date governs), then call again — we do not fetch exchange rates`,
      source_url: record.source_url,
    }, 400);
  }
  const sale_date = parseIsoDate(q.sale_date, todayIso(request));
  if (sale_date === null) return jsonResponse({ error: 'sale_date must be an ISO date (YYYY-MM-DD)' }, 400);

  const eligibility = { in_scope: true, reasons: [] };
  if (jurisdiction === 'uk' && record.effective_from && sale_date < record.effective_from) {
    eligibility.reasons.push(`contracts dated before ${record.effective_from} fall under the previous EUR-denominated regime (ECB conversion) — this computation applies the current GBP basis`);
  }
  const deathYear = q.artist_death_year === undefined || q.artist_death_year === '' ? undefined : parseYear(q.artist_death_year);
  if (deathYear === null) return jsonResponse({ error: 'artist_death_year must be a year' }, 400);
  if (deathYear === undefined) {
    eligibility.reasons.push('artist_death_year not supplied — assuming the artist is living or within the post-mortem term');
  } else {
    const saleYear = Number.parseInt(sale_date.slice(0, 4), 10);
    if (saleYear - deathYear > record.term_pma_years) {
      eligibility.in_scope = false;
      eligibility.reasons.push(`out of term: the right lasts ${record.term_pma_years} years after the artist's death (died ${deathYear}, sold ${saleYear})`);
    } else {
      eligibility.reasons.push(`within the ${record.term_pma_years}-year post-mortem term`);
    }
  }
  eligibility.reasons.push('nationality/qualifying-country conditions and the seller/AMP liability rules are not evaluated here — see the cited regulation');

  let royalty = 0;
  let items = [];
  let capApplied = false;
  const belowThreshold = price < record.threshold;
  if (belowThreshold) {
    eligibility.reasons.push(`below the ${record.threshold} ${basis} threshold — no royalty`);
  } else if (eligibility.in_scope) {
    const banded = applyBands(price, record.bands);
    items = banded.items;
    royalty = banded.total;
    if (royalty > record.cap) {
      royalty = record.cap;
      capApplied = true;
    }
  }

  return jsonResponse({
    schema: 'artbitrage.arr-computation/1',
    input: { price, currency: basis, sale_date, artist_death_year: deathYear ?? null, jurisdiction },
    eligibility,
    line_items: items,
    royalty: eligibility.in_scope && !belowThreshold ? round2(royalty) : 0,
    currency: basis,
    cap: record.cap,
    cap_applied: capApplied,
    collecting_societies: record.societies || [],
    schedule_applied: { id: record.id, status: record.status, source_url: record.source_url, effective_from: record.effective_from || null, verified_at: record.verified_at || null },
    variances: record.variances || [],
    disclosure: DISCLOSURE,
  }, 200, 300);
}

function handleThresholds(trade, q) {
  const jurisdiction = safeString(q.jurisdiction, 20).toLowerCase();
  const kind = safeString(q.kind, 20).toLowerCase();
  const matched = (trade.thresholds || []).filter(t =>
    (!jurisdiction || t.jurisdiction === jurisdiction) && (!kind || t.kind === kind));
  return jsonResponse({
    schema: 'artbitrage.thresholds/1',
    count: matched.length,
    thresholds: matched,
    kinds: [...new Set((trade.thresholds || []).map(t => t.kind))],
    jurisdictions: [...new Set((trade.thresholds || []).map(t => t.jurisdiction))],
    disclosure: DISCLOSURE,
  }, 200, 3600);
}

// ── gates: which licensing/compliance gates does this object cross ─
function handleGates(trade, q, request) {
  const value = parseMoney(q.value);
  const currency = safeString(q.currency, 8).toUpperCase();
  const jurisdiction = safeString(q.jurisdiction, 20).toLowerCase() || 'uk';
  const year = q.year === undefined || q.year === '' ? undefined : parseYear(q.year);
  if (year === null) return jsonResponse({ error: 'year must be the creation year, e.g. year=1890' }, 400);
  const nowYear = Number.parseInt(todayIso(request).slice(0, 4), 10);
  const age = year === undefined ? undefined : nowYear - year;
  const materials = safeString(q.materials, 400).toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const category = safeString(q.category, 80).toLowerCase();

  const gates = [];

  // AML customer due diligence — trigger currency is per-jurisdiction
  // (UK: £10,000 since 2026-06-30 per SI 2026/621; EU: EUR 10,000 per 5AMLD)
  const aml = (trade.thresholds || []).find(t => t.kind === 'aml' && (t.jurisdiction === jurisdiction || t.jurisdiction === 'eu'));
  if (aml && value !== null) {
    let triggered;
    let detail;
    if (currency === aml.trigger_currency) {
      triggered = value >= aml.trigger;
      detail = `customer due diligence at ${aml.trigger} ${aml.trigger_currency} or above (single or linked transactions)`;
    } else {
      triggered = 'depends';
      detail = `threshold is ${aml.trigger} ${aml.trigger_currency} — convert at the transaction date; linked transactions aggregate`;
    }
    gates.push({ id: aml.id, name: 'AML customer due diligence', triggered, regulation: aml.regulation, detail, source_url: aml.source_url, status: aml.status });
  }

  // Export licence (jurisdiction-specific value/age thresholds)
  const exportRec = (trade.thresholds || []).find(t => t.kind === 'export' && t.jurisdiction === jurisdiction);
  if (exportRec && age !== undefined) {
    if (age < exportRec.age_rule_years) {
      gates.push({ id: exportRec.id, name: 'Export licence', triggered: false, regulation: exportRec.regulation, detail: `object is under ${exportRec.age_rule_years} years old`, source_url: exportRec.source_url, status: exportRec.status });
    } else if (value === null || (exportRec.currency && currency && currency !== exportRec.currency)) {
      gates.push({ id: exportRec.id, name: 'Export licence', triggered: 'depends', regulation: exportRec.regulation, detail: `over ${exportRec.age_rule_years} years old — licence depends on value against per-category thresholds in ${exportRec.currency}`, source_url: exportRec.source_url, status: exportRec.status });
    } else {
      const cats = (exportRec.categories || []).filter(c => !category || c.id === category);
      const crossed = cats.filter(c => value >= c.threshold);
      if (category && cats.length === 0) {
        gates.push({ id: exportRec.id, name: 'Export licence', triggered: 'depends', regulation: exportRec.regulation, detail: `unknown category "${category}"`, valid_categories: (exportRec.categories || []).map(c => c.id), source_url: exportRec.source_url, status: exportRec.status });
      } else {
        gates.push({
          id: exportRec.id, name: 'Export licence',
          triggered: category ? crossed.length > 0 : (crossed.length > 0 ? 'depends' : false),
          regulation: exportRec.regulation,
          detail: category
            ? (crossed.length > 0 ? `value meets or exceeds the ${category} threshold` : `value below the ${category} threshold`)
            : (crossed.length > 0 ? `value crosses the threshold for: ${crossed.map(c => c.id).join(', ')} — pass ?category= to resolve` : 'value below every category threshold'),
          source_url: exportRec.source_url, status: exportRec.status,
        });
      }
    }
  }

  // EU import regulation 2019/880 — ages are STRICTLY "more than" per the Annex
  const importRec = (trade.thresholds || []).find(t => t.kind === 'import' && t.jurisdiction === 'eu');
  if (importRec && age !== undefined) {
    for (const part of importRec.parts || []) {
      const ageOk = age > part.age_min_years;
      const valueRelevant = part.value_min_eur != null;
      let triggered;
      let detail;
      if (!ageOk) {
        triggered = false;
        detail = `under ${part.age_min_years} years old`;
      } else if (!valueRelevant) {
        triggered = true;
        detail = `${part.age_min_years}+ years old — ${part.instrument} required regardless of value (${(part.categories || []).join('; ')})`;
      } else if (value === null || currency !== 'EUR') {
        triggered = 'depends';
        detail = `${part.age_min_years}+ years old — ${part.instrument} required at ${part.value_min_eur} EUR or above`;
      } else {
        triggered = value >= part.value_min_eur;
        detail = triggered ? `${part.age_min_years}+ years and ${part.value_min_eur}+ EUR — ${part.instrument} required` : `value below ${part.value_min_eur} EUR`;
      }
      gates.push({ id: `${importRec.id}-${part.part.toLowerCase()}`, name: `EU import ${part.instrument} (Part ${part.part})`, triggered, regulation: importRec.regulation, detail, source_url: importRec.source_url, status: importRec.status });
    }
  }

  // Materials
  for (const m of materials) {
    const rec = (trade.materials || []).find(x => x.material_id === m || (x.aliases || []).includes(m));
    if (!rec) {
      gates.push({ id: `material-${m}`, name: `Material: ${m}`, triggered: 'depends', detail: 'unknown material id', valid_materials: (trade.materials || []).map(x => x.material_id) });
      continue;
    }
    gates.push({
      id: `material-${rec.material_id}`,
      name: `Material: ${rec.common_name}`,
      triggered: rec.restricted !== false,
      regulation: rec.regulation,
      detail: rec.rule_summary,
      exemptions: rec.exemptions || [],
      fees: rec.fees || [],
      source_url: rec.source_url,
      status: rec.status,
    });
  }

  // ARR pointer
  if (value !== null && value >= 1000 && (jurisdiction === 'uk' || jurisdiction === 'eu')) {
    gates.push({ id: 'arr-pointer', name: "Artist's resale right", triggered: 'depends', detail: 'may apply on qualifying resales of works by living artists or within the post-mortem term — compute at /api/trade/arr', source_url: null });
  }

  return jsonResponse({
    schema: 'artbitrage.gates/1',
    input: { year: year ?? null, age: age ?? null, value, currency: currency || null, jurisdiction, materials, category: category || null },
    gates,
    disclosure: DISCLOSURE,
  }, 200, 300);
}

function handleVocab(trade, id) {
  const vocab = trade.vocab || {};
  if (!id) {
    return jsonResponse({
      schema: 'artbitrage.vocab/1',
      vocabularies: Object.entries(vocab).map(([vid, v]) => ({ id: vid, title: v.title, count: (v.terms || []).length })),
      disclosure: DISCLOSURE,
    }, 200, 3600);
  }
  const v = vocab[id];
  if (!v) return jsonResponse({ error: 'vocabulary not found', id, valid_ids: Object.keys(vocab) }, 404);
  return jsonResponse({ schema: 'artbitrage.vocab/1', id, ...v }, 200, 3600);
}

// ══════════════════════════════════════════════════════════════════
// Wave 2-3 — strict validation, witness receipts, voluntary results.
// Clones the answering-rhyme toolkit: canonical JSON, sha256 witness,
// guarded body reader, issues[] error schema, non-capability blocks.
// ══════════════════════════════════════════════════════════════════

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .filter(key => value[key] !== undefined)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function isJsonObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(path, code, message) {
  return { path, code, message };
}

const UNSAFE_CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/u;
const UNSAFE_FORMATTING = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u;

function normText(value, path, issues, { max = 500, required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) issues.push(issue(path, 'required', 'must be present'));
    return undefined;
  }
  if (typeof value !== 'string') {
    issues.push(issue(path, 'wrong_type', 'must be a string'));
    return undefined;
  }
  const normalized = value.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (required && !normalized) issues.push(issue(path, 'required', 'must not be empty'));
  if (normalized.length > max) issues.push(issue(path, 'too_long', `must be at most ${max} characters`));
  if (UNSAFE_CONTROL.test(normalized)) issues.push(issue(path, 'control_character', 'contains a disallowed control character'));
  if (UNSAFE_FORMATTING.test(normalized)) issues.push(issue(path, 'formatting_character', 'contains a disallowed invisible formatting character (bidi control, zero-width, or BOM) — RTL text itself is welcome, invisible controls are not'));
  return normalized || undefined;
}

function normNumber(value, path, issues, { min = 0, max = 1e12, required = false, integer = false } = {}) {
  if (value === undefined || value === null) {
    if (required) issues.push(issue(path, 'required', 'must be present'));
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.push(issue(path, 'wrong_type', 'must be a finite number'));
    return undefined;
  }
  if (integer && !Number.isInteger(value)) issues.push(issue(path, 'wrong_type', 'must be an integer'));
  if (value < min || value > max) issues.push(issue(path, 'out_of_range', `must be between ${min} and ${max}`));
  return value;
}

function rejectUnknown(value, allowed, path, issues, schemaName) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issues.push(issue(`${path}.${key}`, 'unknown_field', `is not part of ${schemaName}`));
  }
}

function tradeError(error, message, status, issues = []) {
  return new Response(JSON.stringify({
    schema: TRADE_ERROR_SCHEMA,
    error,
    message,
    issues,
    authenticated: false,
    identity_verified: false,
    persisted: false,
    authoritative_effect: 'none',
  }, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}

// Guarded body reader: enforces content type, declared and streamed size,
// and fatal UTF-8 decoding. Returns { text, kind } or { error: Response }.
async function readTradeBody(request, { maxBytes }) {
  const contentType = request.headers.get('content-type') || '';
  let kind = null;
  if (/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(contentType)) kind = 'json';
  else if (/^text\/csv(?:\s*;.*)?$/i.test(contentType)) kind = 'csv';
  if (!kind) {
    return { error: tradeError('unsupported_media_type', 'Content-Type must be application/json (UTF-8) or text/csv.', 415) };
  }
  const cap = kind === 'csv' ? MAX_CSV_BYTES : maxBytes;
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > cap) {
    return { error: tradeError('request_too_large', `Request body must not exceed ${cap} bytes.`, 413) };
  }
  if (!request.body) return { error: tradeError('empty_body', 'Request body is required.', 400) };
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let byteLength = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > cap) {
        try { await reader.cancel('trade request exceeds the limit'); } catch {}
        return { error: tradeError('request_too_large', `Request body must not exceed ${cap} bytes.`, 413) };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    try { reader.releaseLock(); } catch {}
    return { error: tradeError('invalid_encoding', 'Request body must be valid UTF-8.', 400) };
  }
  try { reader.releaseLock(); } catch {}
  return { text, kind };
}

// The full non-capability block, cloned from the answering-rhyme witness:
// this endpoint validates and hashes; it has no memory and no effect.
function nonCapabilityBlock({ validated = true } = {}) {
  const block = {
    validated,
    replay_detection: false,
    uniqueness_not_asserted: true,
    authenticated: false,
    identity_verified: false,
    persisted: false,
    persistence: {
      status: 'not-persisted-by-application',
      retrievable_url: null,
      note: 'No application record is created. The caller must carry this unsigned receipt. This does not promise that infrastructure providers keep no ordinary access or security logs.',
    },
    authoritative_effect: 'none',
    issuer_attestation: {
      signed: false,
      independently_verifiable: false,
      note: 'witnessed_at is an unattested server observation, not durable proof that Artbitrage issued this receipt.',
    },
    portability: {
      signed: false,
      recomputable: true,
      note: `Recompute content_hash from the normalized record using ${TRADE_CANONICALIZATION}. The stateless endpoint cannot detect replay or assert uniqueness.`,
    },
  };
  if (!validated) delete block.validated;
  return block;
}

// ── vocab-driven enums (trade.json is the single source of truth) ──
function vocabIds(trade, vocabId) {
  const v = (trade.vocab || {})[vocabId];
  return new Set((v?.terms || []).map(t => t.id || t.code).filter(Boolean));
}

function qualifierInfo(trade, code) {
  const v = (trade.vocab || {})['heading-qualifiers'];
  return (v?.terms || []).find(t => t.code === code) || null;
}

// ── measurements ──────────────────────────────────────────────────
function normalizeMeasurement(m, path, issues) {
  if (!isJsonObject(m)) {
    issues.push(issue(path, 'wrong_type', 'must be an object {dimension, value, unit}'));
    return undefined;
  }
  rejectUnknown(m, new Set(['dimension', 'value', 'unit']), path, issues, LOT_SCHEMA);
  const dimension = normText(m.dimension, `${path}.dimension`, issues, { max: 40, required: true });
  const value = normNumber(m.value, `${path}.value`, issues, { min: 0.001, max: 1e6, required: true });
  const unit = normText(m.unit, `${path}.unit`, issues, { max: 5, required: true });
  if (unit && !(unit in LENGTH_UNITS) && !WEIGHT_UNITS.has(unit)) {
    issues.push(issue(`${path}.unit`, 'unsupported_unit', `must be one of ${[...Object.keys(LENGTH_UNITS), ...WEIGHT_UNITS].join(', ')}`));
  }
  const out = { dimension, value, unit };
  if (unit in LENGTH_UNITS && value !== undefined) {
    out.normalized_cm = Math.round(value * LENGTH_UNITS[unit] * 10) / 10;
  }
  return out;
}

// "73.7 x 68.6 cm", "24 x 23 x 23 cm", "30 × 40 in" → measurements.
// Convention: height × width (× depth).
function parseDimensionsText(text) {
  const m = /^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×]\s*(\d+(?:[.,]\d+)?))?\s*(cm|mm|m|in|ft)\b/i.exec(text.trim());
  if (!m) return null;
  const unit = m[4].toLowerCase();
  const names = ['height', 'width', 'depth'];
  const out = [];
  for (let i = 0; i < 3; i += 1) {
    if (m[i + 1] === undefined) continue;
    const value = Number(m[i + 1].replace(',', '.'));
    const entry = { dimension: names[i], value, unit };
    entry.normalized_cm = Math.round(value * LENGTH_UNITS[unit] * 10) / 10;
    out.push(entry);
  }
  return out;
}

// ── artbitrage.lot/1 validation (strict tier) ─────────────────────
const LOT_FIELDS = new Set(['schema', 'id', 'object', 'heading', 'maker_names', 'estimate', 'reserve_exists', 'lifecycle', 'availability', 'settlement', 'compliance_flags', 'provenance', 'condition_note', 'fee_schedule_ref', 'rights']);
const LOT_OBJECT_FIELDS = new Set(['type', 'title', 'maker', 'maker_dates', 'date_period', 'materials', 'measurements', 'inscriptions', 'distinguishing_features', 'subject', 'edition']);
const OBJECTID_CORE = ['type', 'materials', 'measurements', 'inscriptions', 'distinguishing_features', 'title', 'subject', 'date_period', 'maker'];

function validateLot(value, trade) {
  const issues = [];
  const warnings = [];
  if (!isJsonObject(value)) {
    return { issues: [issue('$', 'wrong_type', 'must be a JSON object')], record: null, warnings };
  }
  rejectUnknown(value, LOT_FIELDS, '$', issues, LOT_SCHEMA);

  const schema = normText(value.schema, '$.schema', issues, { max: 40, required: true });
  if (schema && schema !== LOT_SCHEMA) issues.push(issue('$.schema', 'unsupported_schema', `must equal ${LOT_SCHEMA}`));

  const record = { schema: LOT_SCHEMA };
  record.id = normText(value.id, '$.id', issues, { max: 120 });

  // object — the Object ID nine-field core lives here
  const object = {};
  if (!isJsonObject(value.object)) {
    issues.push(issue('$.object', 'required', 'must be an object carrying the Object ID core fields'));
  } else {
    rejectUnknown(value.object, LOT_OBJECT_FIELDS, '$.object', issues, LOT_SCHEMA);
    object.type = normText(value.object.type, '$.object.type', issues, { max: 120 });
    object.title = normText(value.object.title, '$.object.title', issues, { max: 300 });
    object.maker = normText(value.object.maker, '$.object.maker', issues, { max: 200 });
    object.maker_dates = normText(value.object.maker_dates, '$.object.maker_dates', issues, { max: 60 });
    object.date_period = normText(value.object.date_period, '$.object.date_period', issues, { max: 100 });
    object.inscriptions = normText(value.object.inscriptions, '$.object.inscriptions', issues, { max: 1000 });
    object.distinguishing_features = normText(value.object.distinguishing_features, '$.object.distinguishing_features', issues, { max: 1000 });
    object.subject = normText(value.object.subject, '$.object.subject', issues, { max: 300 });
    object.edition = normText(value.object.edition, '$.object.edition', issues, { max: 300 });
    if (value.object.materials !== undefined) {
      if (!Array.isArray(value.object.materials)) {
        issues.push(issue('$.object.materials', 'wrong_type', 'must be an array of strings'));
      } else {
        object.materials = value.object.materials.slice(0, 30)
          .map((m, i) => normText(m, `$.object.materials[${i}]`, issues, { max: 120 })).filter(Boolean);
      }
    }
    if (value.object.measurements !== undefined) {
      if (!Array.isArray(value.object.measurements)) {
        issues.push(issue('$.object.measurements', 'wrong_type', 'must be an array of {dimension, value, unit}'));
      } else {
        object.measurements = value.object.measurements.slice(0, 12)
          .map((m, i) => normalizeMeasurement(m, `$.object.measurements[${i}]`, issues)).filter(Boolean);
      }
    }
    if (!object.title && !object.type) {
      issues.push(issue('$.object', 'insufficient_identification', 'at least one of title or type is required'));
    }
  }
  record.object = object;
  const present = OBJECTID_CORE.filter(f => object[f] !== undefined && (!Array.isArray(object[f]) || object[f].length > 0));
  record.objectid_core = { present, missing: OBJECTID_CORE.filter(f => !present.includes(f)) };
  if (record.objectid_core.missing.length > 0) {
    warnings.push({ path: '$.object', code: 'objectid_core_incomplete', message: `Object ID core fields missing: ${record.objectid_core.missing.join(', ')} — a complete core makes the record identifiable if the object is lost or stolen.` });
  }

  // heading — warranty_bearing is COMPUTED from the vocabulary, never accepted
  if (value.heading !== undefined) {
    if (!isJsonObject(value.heading)) {
      issues.push(issue('$.heading', 'wrong_type', 'must be an object {display, qualifier_code}'));
    } else {
      rejectUnknown(value.heading, new Set(['display', 'qualifier_code']), '$.heading', issues, LOT_SCHEMA);
      const display = normText(value.heading.display, '$.heading.display', issues, { max: 300 });
      const qualifierCode = normText(value.heading.qualifier_code, '$.heading.qualifier_code', issues, { max: 60 });
      const heading = { display, qualifier_code: qualifierCode };
      if (qualifierCode) {
        const info = qualifierInfo(trade, qualifierCode);
        if (!info) {
          issues.push(issue('$.heading.qualifier_code', 'unknown_qualifier', `not in the heading-qualifiers vocabulary — see /api/trade/vocab/heading-qualifiers`));
        } else {
          heading.warranty_bearing = info.warranty_bearing === true;
        }
      }
      record.heading = heading;
    }
  }

  if (value.maker_names !== undefined) {
    if (!Array.isArray(value.maker_names)) {
      issues.push(issue('$.maker_names', 'wrong_type', 'must be an array of {value, script?, system?}'));
    } else {
      record.maker_names = value.maker_names.slice(0, 12).map((n, i) => {
        if (!isJsonObject(n)) { issues.push(issue(`$.maker_names[${i}]`, 'wrong_type', 'must be an object')); return null; }
        rejectUnknown(n, new Set(['value', 'script', 'system']), `$.maker_names[${i}]`, issues, LOT_SCHEMA);
        return {
          value: normText(n.value, `$.maker_names[${i}].value`, issues, { max: 200, required: true }),
          script: normText(n.script, `$.maker_names[${i}].script`, issues, { max: 20 }),
          system: normText(n.system, `$.maker_names[${i}].system`, issues, { max: 30 }),
        };
      }).filter(Boolean);
    }
  }

  if (value.estimate !== undefined) {
    if (!isJsonObject(value.estimate)) {
      issues.push(issue('$.estimate', 'wrong_type', 'must be an object {low, high, currency}'));
    } else {
      rejectUnknown(value.estimate, new Set(['low', 'high', 'currency']), '$.estimate', issues, LOT_SCHEMA);
      const low = normNumber(value.estimate.low, '$.estimate.low', issues, { min: 0 });
      const high = normNumber(value.estimate.high, '$.estimate.high', issues, { min: 0 });
      const currency = normText(value.estimate.currency, '$.estimate.currency', issues, { max: 3, required: true });
      if (currency && !CURRENCY_RE.test(currency)) issues.push(issue('$.estimate.currency', 'invalid_currency', 'must be a 3-letter ISO code, uppercase'));
      if (low !== undefined && high !== undefined && low > high) issues.push(issue('$.estimate', 'inverted_range', 'low must not exceed high'));
      record.estimate = { low, high, currency };
    }
  }

  if (value.reserve_exists !== undefined && value.reserve_exists !== null && typeof value.reserve_exists !== 'boolean') {
    issues.push(issue('$.reserve_exists', 'wrong_type', 'must be true, false, or null (unknown)'));
  } else if (value.reserve_exists !== undefined) {
    record.reserve_exists = value.reserve_exists;
  }

  const lifecycleIds = vocabIds(trade, 'lot-lifecycle');
  record.lifecycle = normText(value.lifecycle, '$.lifecycle', issues, { max: 30 });
  if (record.lifecycle && !lifecycleIds.has(record.lifecycle)) {
    issues.push(issue('$.lifecycle', 'unknown_state', `not in the lot-lifecycle vocabulary (${[...lifecycleIds].join(', ')})`));
  }
  const availabilityIds = vocabIds(trade, 'gallery-availability');
  record.availability = normText(value.availability, '$.availability', issues, { max: 30 });
  if (record.availability && !availabilityIds.has(record.availability)) {
    issues.push(issue('$.availability', 'unknown_state', `not in the gallery-availability vocabulary (${[...availabilityIds].join(', ')})`));
  }

  if (value.settlement !== undefined) {
    if (!isJsonObject(value.settlement)) {
      issues.push(issue('$.settlement', 'wrong_type', 'must be an object {status, measured_at}'));
    } else {
      rejectUnknown(value.settlement, new Set(['status', 'measured_at']), '$.settlement', issues, LOT_SCHEMA);
      const statusIds = vocabIds(trade, 'settlement-status');
      const status = normText(value.settlement.status, '$.settlement.status', issues, { max: 30, required: true });
      if (status && !statusIds.has(status)) {
        issues.push(issue('$.settlement.status', 'unknown_state', `not in the settlement-status vocabulary (${[...statusIds].join(', ')})`));
      }
      const measuredAt = normText(value.settlement.measured_at, '$.settlement.measured_at', issues, { max: 10 });
      if (measuredAt && !isRealDate(measuredAt)) issues.push(issue('$.settlement.measured_at', 'invalid_date', 'must be a real calendar date, YYYY-MM-DD'));
      record.settlement = { status, measured_at: measuredAt };
    }
  }

  if (value.compliance_flags !== undefined) {
    if (!isJsonObject(value.compliance_flags)) {
      issues.push(issue('$.compliance_flags', 'wrong_type', 'must be an object'));
    } else {
      rejectUnknown(value.compliance_flags, new Set(['species_materials', 'made_before', 'arr_candidate', 'export_gate_candidates']), '$.compliance_flags', issues, LOT_SCHEMA);
      const flags = {};
      if (value.compliance_flags.species_materials !== undefined) {
        if (!Array.isArray(value.compliance_flags.species_materials)) {
          issues.push(issue('$.compliance_flags.species_materials', 'wrong_type', 'must be an array of material ids'));
        } else {
          flags.species_materials = value.compliance_flags.species_materials.slice(0, 12)
            .map((m, i) => normText(m, `$.compliance_flags.species_materials[${i}]`, issues, { max: 60 })).filter(Boolean)
            .map(m => {
              const rec = (trade.materials || []).find(x => x.material_id === m || (x.aliases || []).includes(m));
              if (!rec) issues.push(issue('$.compliance_flags.species_materials', 'unknown_material', `"${m}" — see /api/trade/gates valid materials`));
              return rec ? rec.material_id : m;
            });
        }
      }
      flags.made_before = normNumber(value.compliance_flags.made_before, '$.compliance_flags.made_before', issues, { min: -10000, max: 3000, integer: true });
      if (value.compliance_flags.arr_candidate !== undefined && typeof value.compliance_flags.arr_candidate !== 'boolean') {
        issues.push(issue('$.compliance_flags.arr_candidate', 'wrong_type', 'must be a boolean'));
      } else {
        flags.arr_candidate = value.compliance_flags.arr_candidate;
      }
      if (value.compliance_flags.export_gate_candidates !== undefined) {
        if (!Array.isArray(value.compliance_flags.export_gate_candidates)) {
          issues.push(issue('$.compliance_flags.export_gate_candidates', 'wrong_type', 'must be an array of strings'));
        } else {
          flags.export_gate_candidates = value.compliance_flags.export_gate_candidates.slice(0, 12)
            .map((c, i) => normText(c, `$.compliance_flags.export_gate_candidates[${i}]`, issues, { max: 80 })).filter(Boolean);
        }
      }
      record.compliance_flags = flags;
    }
  }

  // material hints: object.materials mentioning a gated material the flags miss
  const declaredSpecies = new Set(record.compliance_flags?.species_materials || []);
  for (const mat of object.materials || []) {
    const lower = mat.toLowerCase();
    for (const rec of trade.materials || []) {
      if (rec.restricted === false) continue;
      const hit = [rec.material_id, ...(rec.aliases || [])].some(a => lower.includes(a.replace(/[-_]/g, ' ')) || lower.includes(a));
      if (hit && !declaredSpecies.has(rec.material_id)) {
        warnings.push({ path: '$.object.materials', code: 'possible_material_gate', message: `"${mat}" may be ${rec.common_name} — if so, declare compliance_flags.species_materials and see /api/trade/gates?materials=${rec.material_id}` });
      }
    }
  }

  if (value.provenance !== undefined) {
    if (!isJsonObject(value.provenance)) {
      issues.push(issue('$.provenance', 'wrong_type', 'must be an object {display_string} and/or {events}'));
    } else {
      rejectUnknown(value.provenance, new Set(['display_string', 'events']), '$.provenance', issues, LOT_SCHEMA);
      if (Object.prototype.hasOwnProperty.call(value.provenance, 'events')) {
        issues.push(issue('$.provenance.events', 'not_accepted_here', 'lots carry the display form only — round-trip structured events at POST /api/trade/provenance'));
      }
      const displayString = normText(value.provenance.display_string, '$.provenance.display_string', issues, { max: 4000 });
      record.provenance = { display_string: displayString };
      // parse only clean, bounded input — never spend parser CPU on a string
      // that is already rejected (an un-truncated 64KB body must not be parsed)
      if (displayString && displayString.length <= 4000 && issues.length === 0) {
        const parsed = parseProvenance(displayString);
        record.provenance.events = parsed.events;
        for (const w of parsed.parse_warnings) {
          warnings.push({ path: '$.provenance.display_string', code: 'provenance_parse', message: w });
        }
      }
    }
  }

  record.condition_note = normText(value.condition_note, '$.condition_note', issues, { max: 2000 });

  record.fee_schedule_ref = normText(value.fee_schedule_ref, '$.fee_schedule_ref', issues, { max: 80 });
  if (record.fee_schedule_ref && !(trade.fee_schedules || []).some(s => s.id === record.fee_schedule_ref)) {
    warnings.push({ path: '$.fee_schedule_ref', code: 'unknown_schedule', message: 'no fee schedule with that id — see /api/trade/fees' });
  }

  if (value.rights !== undefined) {
    if (!isJsonObject(value.rights)) {
      issues.push(issue('$.rights', 'wrong_type', 'must be an object {license?, credit?, note?}'));
    } else {
      rejectUnknown(value.rights, new Set(['license', 'credit', 'note']), '$.rights', issues, LOT_SCHEMA);
      record.rights = {
        license: normText(value.rights.license, '$.rights.license', issues, { max: 120 }),
        credit: normText(value.rights.credit, '$.rights.credit', issues, { max: 300 }),
        note: normText(value.rights.note, '$.rights.note', issues, { max: 500 }),
      };
    }
  }

  return { issues, record: issues.length === 0 ? record : null, warnings };
}

// ── CSV door — Artlogic-vocabulary fuzzy header mapping ───────────
// Header names verified verbatim from Artlogic's public import documentation
// (support.artlogic.net), plus Art Galleria / Artwork Archive variants.
// Living-party columns are DELIBERATELY ignored: an open validator must not
// invite current-owner or buyer identities (TRADE-MODULE.md red lines).
function normHeader(h) {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const CSV_HEADER_MAP = {
  artist: 'maker', artistfirstname: 'maker_first', artistlastname: 'maker_last',
  artistdates: 'maker_dates',
  title: 'title', piecename: 'title',
  year: 'date_period', creationdate: 'date_period', period: 'date_period',
  medium: 'materials', artworktype: 'type', type: 'type',
  dimensions: 'dimensions_text',
  height: 'dim_height', width: 'dim_width', depth: 'dim_depth',
  stocknumber: 'id', inventoryid: 'id', artistsreferencenumber: 'id',
  retailcurrency: 'currency', currency: 'currency',
  retailprice: 'price', price: 'price',
  status: 'artlogic_status', availability: 'artlogic_availability',
  provenance: 'provenance',
  signedanddated: 'inscriptions', signature: 'inscriptions',
  editiondetails: 'edition', edition: 'edition',
  condition: 'condition_note', conditionnotes: 'condition_note',
  commentaryordescription: 'distinguishing_features', description: 'distinguishing_features',
  subjectmatter: 'subject', genre: 'subject',
};

const CSV_IGNORED_PRIVACY = new Set(['currentowner', 'currentownername', 'owner', 'ownername', 'soldto', 'soldtoname', 'consignedby', 'consignor', 'consultant', 'clientname', 'client', 'clientemail', 'buyer', 'buyername', 'purchaser', 'collector', 'collectorname']);
const ARTLOGIC_AVAILABILITY = { available: 'available', reserved: 'on_hold', onloan: 'on_loan', sold: 'sold' };
const ARTLOGIC_STATUS = { onconsignment: 'on_consignment', stock: 'available' };

function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  let rowSawQuote = false; // '""' is an explicit (empty) field, not a blank line
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
      rowSawQuote = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '' || rowSawQuote) rows.push(row);
      row = [];
      rowSawQuote = false;
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); if (row.length > 1 || row[0] !== '' || rowSawQuote) rows.push(row); }
  return rows;
}

// Locale-aware price reading: "1,234.56" (UK/US), "1.234,56" (European),
// "1234.56", "1234". Returns null when the format is ambiguous or non-numeric —
// a wrong price validated and hashed is worse than no price.
function parsePriceNumber(text) {
  let t = String(text).replace(/[£$€¥\s]/g, '');
  if (!/^[0-9.,]+$/.test(t) || t === '') return null;
  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    // both present: the later one is the decimal separator
    if (lastComma > lastDot) t = t.replace(/\./g, '').replace(',', '.');
    else t = t.replace(/,/g, '');
  } else if (lastComma !== -1) {
    const after = t.length - lastComma - 1;
    const commas = (t.match(/,/g) || []).length;
    if (after === 3 && commas >= 1 && /^\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/,/g, ''); // 1,234 / 1,234,567
    else if (after !== 3 && commas === 1) t = t.replace(',', '.'); // 1234,56
    else return null; // e.g. "1,23,45" — ambiguous
  } else if (lastDot !== -1) {
    const after = t.length - lastDot - 1;
    const dots = (t.match(/\./g) || []).length;
    if (dots > 1) {
      if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); // 1.234.567 European grouping
      else return null;
    }
    // single dot: decimal separator (1234.56) — "1.234" alone stays 1.234:
    // treating it as European grouping would corrupt genuine decimals; the
    // mapping note carries the parsed value so the submitter can catch it.
    void after;
  }
  const num = Number(t);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
}

// Casual-tier coercion: one CSV row → a lot/1-shaped object, then the same
// strict validator re-validates. Coercions are reported, never silent.
function coerceCsvRow(headers, cells, trade) {
  const mappingNotes = [];
  const raw = {};
  headers.forEach((h, i) => {
    const cell = (cells[i] || '').trim();
    if (!cell) return;
    if (CSV_IGNORED_PRIVACY.has(h.norm)) {
      mappingNotes.push(`column "${h.original}" ignored: living-party privacy — an open validator must not carry owner or buyer identities`);
      return;
    }
    const target = CSV_HEADER_MAP[h.norm];
    if (!target) return; // reported once at file level
    raw[target] = cell;
  });

  const lot = { schema: LOT_SCHEMA, object: {} };
  if (raw.id) lot.id = raw.id;
  if (raw.title) lot.object.title = raw.title;
  if (raw.type) lot.object.type = raw.type;
  const maker = raw.maker || [raw.maker_first, raw.maker_last].filter(Boolean).join(' ');
  if (maker) lot.object.maker = maker;
  if (raw.maker_dates) lot.object.maker_dates = raw.maker_dates;
  if (raw.date_period) lot.object.date_period = raw.date_period;
  if (raw.materials) lot.object.materials = [raw.materials];
  if (raw.inscriptions) lot.object.inscriptions = raw.inscriptions;
  if (raw.edition) lot.object.edition = raw.edition;
  if (raw.subject) lot.object.subject = raw.subject;
  if (raw.distinguishing_features) lot.object.distinguishing_features = raw.distinguishing_features;
  if (raw.condition_note) lot.condition_note = raw.condition_note;

  if (raw.dimensions_text) {
    const parsed = parseDimensionsText(raw.dimensions_text);
    if (parsed) {
      // hand the strict validator inputs only — it recomputes normalized_cm
      lot.object.measurements = parsed.map(({ dimension, value, unit }) => ({ dimension, value, unit }));
      mappingNotes.push(`dimensions "${raw.dimensions_text}" parsed as height × width${parsed.length > 2 ? ' × depth' : ''}`);
    } else {
      lot.object.distinguishing_features = [lot.object.distinguishing_features, `Dimensions: ${raw.dimensions_text}`].filter(Boolean).join(' — ');
      mappingNotes.push(`dimensions "${raw.dimensions_text}" not parseable — carried verbatim in distinguishing_features`);
    }
  } else if (raw.dim_height || raw.dim_width || raw.dim_depth) {
    const dims = [];
    for (const [key, name] of [['dim_height', 'height'], ['dim_width', 'width'], ['dim_depth', 'depth']]) {
      if (!raw[key]) continue;
      const value = Number(String(raw[key]).replace(',', '.'));
      if (Number.isFinite(value) && value > 0) dims.push({ dimension: name, value, unit: 'cm' });
    }
    if (dims.length) {
      lot.object.measurements = dims;
      mappingNotes.push('separate Height/Width/Depth columns assumed to be centimetres (Art Galleria / Artwork Archive convention states no unit)');
    }
  }

  if (raw.price) {
    const num = parsePriceNumber(raw.price);
    const currency = (raw.currency || '').toUpperCase().replace('£', 'GBP').replace('$', 'USD').replace('€', 'EUR');
    if (num !== null && num > 0 && CURRENCY_RE.test(currency)) {
      lot.estimate = { low: num, high: num, currency };
      mappingNotes.push(`retail price "${raw.price}" parsed as ${num} ${currency}, mapped to estimate low = high — a gallery asking price is not an auction estimate; verify the parsed value and adjust before offering at auction`);
    } else if (num === null) {
      mappingNotes.push(`price "${raw.price}" not mapped — ambiguous or non-numeric (decimal-comma and decimal-point formats are both supported when unambiguous)`);
    } else {
      mappingNotes.push(`price "${raw.price}" ${raw.currency ? `(${raw.currency})` : '(no currency column)'} not mapped — needs a positive price and a 3-letter currency`);
    }
  }

  if (raw.artlogic_availability) {
    const mapped = ARTLOGIC_AVAILABILITY[normHeader(raw.artlogic_availability)];
    if (mapped) lot.availability = mapped;
    else mappingNotes.push(`availability "${raw.artlogic_availability}" has no gallery-availability mapping`);
  } else if (raw.artlogic_status) {
    const mapped = ARTLOGIC_STATUS[normHeader(raw.artlogic_status)];
    if (mapped) lot.availability = mapped;
  }

  if (raw.provenance) lot.provenance = { display_string: raw.provenance };

  return { lot, mappingNotes };
}

// ── aam-provenance/1 — parse & generate ───────────────────────────
// Semantics verified 2026-07-16 against museumprovenance.org (CMOA standard),
// Getty CDWA, and museum provenance pages. Semicolon/period and the
// parenthesis-for-dealers rule follow the AAM/CMOA family; NCMA and LACMA
// invert brackets/parentheses, so the grammar carries that variance note.
const PROV_ABBREV = new Set(['mr', 'mrs', 'ms', 'dr', 'jr', 'sr', 'st', 'no', 'nos', 'co', 'inc', 'ltd', 'ca', 'dept', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'prof', 'rev', 'hon', 'capt', 'col', 'gen']);

const PROV_METHODS = [
  [/^purchased (?:at auction )?(?:by|from)?\s*/i, 'purchase'],
  [/^bought by\s*/i, 'purchase'],
  [/^acquired by\s*/i, 'acquisition'],
  [/^by inheritance to\s*/i, 'inheritance'],
  [/^inherited by\s*/i, 'inheritance'],
  [/^by descent to\s*/i, 'descent'],
  [/^by descent[,;]?\s*/i, 'descent'],
  [/^(?:gift|gifted|given|donated) (?:of|to|by)\s*/i, 'gift'],
  [/^beque(?:st,? to|athed to)\s*/i, 'bequest'],
  [/^by bequest[,;]?\s*/i, 'bequest'],
  [/^transferred to\s*/i, 'transfer'],
  [/^sold to\s*/i, 'sale'],
  [/^commissioned by\s*/i, 'commission'],
  [/^consigned to\s*/i, 'consignment'],
];

function splitProvenanceClauses(text) {
  const clauses = [];
  let current = '';
  let parens = 0;
  let inQuote = false;
  const separators = [];
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === '“' || c === '”') inQuote = !inQuote;
    if (c === '(') parens += 1;
    if (c === ')') parens = Math.max(0, parens - 1);
    if (!inQuote && parens === 0 && (c === ';' || c === '.')) {
      if (c === '.') {
        const prevWord = /([A-Za-z]+)\.$/.exec(current + '.');
        // "J.P." — an initial may be preceded by another initial's period
        const isInitial = /(?:^|[\s(.])[A-Z]\.$/.test(current + '.');
        const isAbbrev = prevWord && PROV_ABBREV.has(prevWord[1].toLowerCase());
        const next = text.slice(i + 1).trimStart();
        const looksLikeEnd = next === '' || /^[A-Z(“"]/.test(next);
        // "…Duveen Brothers Inc. Acquired by…" — a business abbreviation can
        // legitimately end a period; a following acquisition-method or
        // certainty keyword marks a real boundary despite the abbreviation.
        const nextStartsClause = /^(Purchased|Bought|Acquired|Sold|Gift|Gifted|Given|Donated|Beque|By descent|By inheritance|Inherited|Transferred|Commissioned|Consigned|Possibly|Probably)\b/i.test(next);
        if ((isInitial || isAbbrev) && !nextStartsClause) { current += c; continue; }
        if (!isInitial && !isAbbrev && !looksLikeEnd) { current += c; continue; }
      }
      if (current.trim()) { clauses.push(current.trim()); separators.push(c); }
      current = '';
      continue;
    }
    current += c;
  }
  if (current.trim()) { clauses.push(current.trim()); separators.push(null); }
  return { clauses, separators };
}

function parseProvenance(text) {
  const parse_warnings = [];
  const normalized = text.normalize('NFC').replace(/\s+/g, ' ').trim();
  const { clauses, separators } = splitProvenanceClauses(normalized);
  const events = clauses.map((clauseText, index) => {
    let clause = clauseText;
    const event = { seq: index + 1, party: {} };

    const certaintyMatch = /^(Possibly|Probably)\s+/i.exec(clause);
    if (certaintyMatch) {
      event.period_certainty = certaintyMatch[1].toLowerCase();
      clause = clause.slice(certaintyMatch[0].length);
    }

    const footnotes = [];
    const citations = [];
    clause = clause.replace(/\s*\[(\d+)\]/g, (_, n) => { footnotes.push(n); return ''; });
    clause = clause.replace(/\s*\[([a-z])\]/g, (_, l) => { citations.push(l); return ''; });
    if (footnotes.length) event.footnote = footnotes[0];
    if (footnotes.length > 1) parse_warnings.push(`clause ${index + 1}: multiple footnote markers — the convention allows at most one per period`);
    if (citations.length) event.citations = citations;

    const lifeDates = /\[(\d{3,4}\??|)-(\d{3,4}\??|)\]/.exec(clause);
    if (lifeDates) {
      event.party.life_dates = { born: lifeDates[1] || null, died: lifeDates[2] || null };
      clause = clause.replace(lifeDates[0], '').replace(/\s{2,}/g, ' ').trim();
    }

    if (/^\(.*\)$/.test(clause)) {
      event.party.role = 'dealer-agent-or-auction';
      clause = clause.slice(1, -1).trim();
    } else {
      event.party.role = 'owner';
    }

    for (const [re, method] of PROV_METHODS) {
      const m = re.exec(clause);
      if (m) { event.method = method; clause = clause.slice(m[0].length); break; }
    }

    const namedEvent = /[“"]([^“”"]+)[”"]/.exec(clause);
    if (namedEvent) {
      event.named_event = namedEvent[1];
      clause = clause.replace(namedEvent[0], '').replace(/\s*(?:at|through)\s*,?\s*/i, ' ').replace(/\s{2,}/g, ' ').trim();
    }

    const dateMatch = /(?:,\s*)?\b(sometime after|after|by|until|circa|ca\.?|in)?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{4}s?(?:\s*[-–]\s*\d{4})?)\??\s*$/.exec(clause);
    if (dateMatch && dateMatch[2]) {
      event.date = { text: (dateMatch[1] ? dateMatch[1] + ' ' : '') + dateMatch[2] };
      if (dateMatch[1]) {
        const q = dateMatch[1].toLowerCase();
        event.date.qualifier = (q === 'ca' || q === 'ca.') ? 'circa' : q;
      }
      if (/\?\s*$/.test(clauseText) && !clause.endsWith('?')) event.date.certainty = 'uncertain';
      const years = dateMatch[2].match(/\d{4}/g);
      if (years) { event.date.year_from = Number(years[0]); event.date.year_to = Number(years[years.length - 1] || years[0]); }
      clause = clause.slice(0, dateMatch.index).replace(/,\s*$/, '').trim();
    }

    const fromMatch = /\bfrom\s+(.+)$/.exec(clause);
    if (fromMatch && event.method) {
      event.source = fromMatch[1].replace(/,\s*$/, '');
      clause = clause.slice(0, fromMatch.index).replace(/,\s*$/, '').trim();
    }
    const forMatch = /\bfor\s+(.+)$/.exec(clause);
    if (forMatch && (event.method === 'purchase' || event.method === 'acquisition')) {
      event.party.agent = clause.slice(0, forMatch.index).replace(/,\s*$/, '').trim();
      clause = forMatch[1].trim();
    }

    const segments = clause.split(',').map(s => s.trim()).filter(Boolean);
    if (segments.length === 0) {
      parse_warnings.push(`clause ${index + 1}: no party name found in "${clauseText}"`);
      event.party.display = clauseText;
      event.confidence = 'low';
      return event;
    }
    let display = segments[0];
    let rest = segments.slice(1);
    if (rest.length && /^(son|daughter|wife|husband|brother|sister|nephew|niece|widow|grandson|granddaughter|cousin) of/i.test(rest[0])) {
      event.party.relationship = rest[0];
      rest = rest.slice(1);
    }
    // honorific glue: "Dr. H. H. Serunian" style names survive as segment 0
    if (display.endsWith('?')) {
      event.party.name_certainty = 'uncertain';
      display = display.slice(0, -1);
    }
    event.party.display = display;
    if (rest.length) {
      let location = rest.join(', ');
      if (location.endsWith('?')) {
        event.location_certainty = 'uncertain';
        location = location.slice(0, -1);
      }
      event.location = location;
    }
    event.confidence = parse_warnings.some(w => w.startsWith(`clause ${index + 1}:`)) ? 'medium' : 'high';
    return event;
  });

  // fix transfer semantics: the closing punctuation of clause i governs the
  // transfer INTO clause i+1
  for (let i = 0; i < events.length; i += 1) {
    events[i].transfer_from_previous = i === 0 ? null
      : separators[i - 1] === ';' ? 'direct'
        : 'not_known_direct';
    delete events[i].direct_transfer_to_next;
  }

  return { schema: PROV_SCHEMA, grammar: PROV_GRAMMAR, events, parse_warnings };
}

function generateProvenance(events) {
  const parts = events.map((e, i) => {
    let s = '';
    if (e.period_certainty) s += e.period_certainty[0].toUpperCase() + e.period_certainty.slice(1) + ' ';
    if (e.method) {
      const phrase = { purchase: 'purchased by', inheritance: 'by inheritance to', descent: 'by descent to', gift: 'gift to', bequest: 'bequest, to', transfer: 'transferred to', sale: 'sold to', acquisition: 'acquired by', commission: 'commissioned by', consignment: 'consigned to' }[e.method];
      if (phrase) s += (i === 0 && !e.period_certainty ? phrase[0].toUpperCase() + phrase.slice(1) : phrase) + ' ';
    }
    let body = e.party?.display || 'Unknown';
    if (e.party?.name_certainty === 'uncertain') body += '?';
    if (e.party?.relationship) body += `, ${e.party.relationship}`;
    if (e.location) body += `, ${e.location}${e.location_certainty === 'uncertain' ? '?' : ''}`;
    if (e.date?.text) body += `, ${e.date.text}`;
    if (e.party?.life_dates) body += ` [${e.party.life_dates.born || ''}-${e.party.life_dates.died || ''}]`;
    if (e.footnote) body += ` [${e.footnote}]`;
    for (const c of e.citations || []) body += ` [${c}]`;
    s += body;
    if (e.party?.role === 'dealer-agent-or-auction') s = `(${s})`;
    const next = events[i + 1];
    const closer = !next ? '.' : next.transfer_from_previous === 'direct' ? ';' : '.';
    return s + closer;
  });
  return parts.join(' ');
}

// ── artbitrage.auction-results/1 validation ───────────────────────
const RESULTS_FIELDS = new Set(['schema', 'house', 'sale', 'price_basis', 'lots']);
const RESULT_SALE_FIELDS = new Set(['name', 'location', 'date', 'currency']);
const RESULT_LOT_FIELDS = new Set(['lot_number', 'outcome', 'price', 'price_withheld', 'currency', 'maker', 'title', 'heading_display']);

function validateResults(value, trade) {
  const issues = [];
  if (!isJsonObject(value)) return { issues: [issue('$', 'wrong_type', 'must be a JSON object')], record: null };
  rejectUnknown(value, RESULTS_FIELDS, '$', issues, RESULTS_SCHEMA);

  const schema = normText(value.schema, '$.schema', issues, { max: 40, required: true });
  if (schema && schema !== RESULTS_SCHEMA) issues.push(issue('$.schema', 'unsupported_schema', `must equal ${RESULTS_SCHEMA}`));

  const house = normText(value.house, '$.house', issues, { max: 60, required: true });
  if (house && !/^[a-z0-9-]+$/.test(house)) issues.push(issue('$.house', 'invalid_format', 'must be a lowercase kebab-case slug, e.g. "sothebys" or "your-house-name"'));

  let sale = {};
  if (!isJsonObject(value.sale)) {
    issues.push(issue('$.sale', 'required', 'must be an object {name, location, date, currency}'));
  } else {
    rejectUnknown(value.sale, RESULT_SALE_FIELDS, '$.sale', issues, RESULTS_SCHEMA);
    sale = {
      name: normText(value.sale.name, '$.sale.name', issues, { max: 200, required: true }),
      location: normText(value.sale.location, '$.sale.location', issues, { max: 100 }),
      date: normText(value.sale.date, '$.sale.date', issues, { max: 10, required: true }),
      currency: normText(value.sale.currency, '$.sale.currency', issues, { max: 3, required: true }),
    };
    if (sale.date && !isRealDate(sale.date)) issues.push(issue('$.sale.date', 'invalid_date', 'must be a real calendar date, YYYY-MM-DD'));
    if (sale.currency && !CURRENCY_RE.test(sale.currency)) issues.push(issue('$.sale.currency', 'invalid_currency', 'must be a 3-letter ISO code, uppercase'));
  }

  // Houses publish premium-inclusive prices and do not publish hammer per-lot
  // (verified 2026-07-16 across Sotheby's/Christie's/Phillips/Bonhams), and
  // Sotheby's says only "customarily" — so the basis is DECLARED, never inferred.
  const priceBasis = normText(value.price_basis, '$.price_basis', issues, { max: 20, required: true });
  if (priceBasis && !PRICE_BASES.has(priceBasis)) {
    issues.push(issue('$.price_basis', 'unsupported_basis', 'must be "hammer" or "premium_inclusive" (premium_inclusive = the published buyer-side total excluding taxes)'));
  }

  const lots = [];
  if (!Array.isArray(value.lots) || value.lots.length === 0) {
    issues.push(issue('$.lots', 'required', 'must be a non-empty array of lot results'));
  } else if (value.lots.length > MAX_RESULT_LOTS) {
    issues.push(issue('$.lots', 'too_many_items', `must contain at most ${MAX_RESULT_LOTS} lots per submission`));
  } else {
    value.lots.forEach((l, i) => {
      const path = `$.lots[${i}]`;
      if (!isJsonObject(l)) { issues.push(issue(path, 'wrong_type', 'must be an object')); return; }
      rejectUnknown(l, RESULT_LOT_FIELDS, path, issues, RESULTS_SCHEMA);
      const lotNumberRaw = typeof l.lot_number === 'number' && Number.isFinite(l.lot_number) ? String(l.lot_number) : l.lot_number;
      const lot = {
        lot_number: normText(lotNumberRaw, `${path}.lot_number`, issues, { max: 20, required: true }),
        outcome: normText(l.outcome, `${path}.outcome`, issues, { max: 20, required: true }),
        maker: normText(l.maker, `${path}.maker`, issues, { max: 200 }),
        title: normText(l.title, `${path}.title`, issues, { max: 200 }),
        heading_display: normText(l.heading_display, `${path}.heading_display`, issues, { max: 200 }),
      };
      if (lot.outcome && !LOT_OUTCOMES.has(lot.outcome)) {
        issues.push(issue(`${path}.outcome`, 'unsupported_outcome', `must be one of ${[...LOT_OUTCOMES].join(', ')}`));
      }
      const withheld = l.price_withheld === true;
      const sold = lot.outcome === 'sold' || lot.outcome === 'post_sale_sold';
      if (l.price !== undefined && l.price !== null) {
        lot.price = normNumber(l.price, `${path}.price`, issues, { min: 0.01 });
      }
      if (withheld && !sold) {
        issues.push(issue(`${path}.price_withheld`, 'conflict', `price_withheld applies only to sold lots — a ${lot.outcome || 'non-sold'} lot has no price to withhold`));
      }
      if (withheld && sold) lot.price_withheld = true;
      if (sold) {
        if (lot.price === undefined && !withheld) {
          issues.push(issue(`${path}.price`, 'required', 'a sold lot needs a price, or price_withheld: true ("Price on request")'));
        }
        if (lot.price !== undefined && withheld) {
          issues.push(issue(`${path}.price`, 'conflict', 'price and price_withheld are mutually exclusive'));
        }
      } else if (lot.price !== undefined) {
        issues.push(issue(`${path}.price`, 'conflict', `a ${lot.outcome} lot must not carry a price`));
      }
      if (l.currency !== undefined) {
        lot.currency = normText(l.currency, `${path}.currency`, issues, { max: 3 });
        if (lot.currency && !CURRENCY_RE.test(lot.currency)) issues.push(issue(`${path}.currency`, 'invalid_currency', 'must be a 3-letter ISO code'));
      }
      lots.push(lot);
    });
  }

  const record = issues.length === 0 ? { schema: RESULTS_SCHEMA, house, sale, price_basis: priceBasis, lots } : null;
  return { issues, record };
}

// ── contract documents (GET) ──────────────────────────────────────
function lotsContract() {
  return {
    schema: LOT_SCHEMA,
    canonicalization: TRADE_CANONICALIZATION,
    purpose: 'A portable, vendor-neutral syndication record for one artwork/lot. POST validates and echoes with a content hash; nothing is stored. The Object ID nine-field core (type, materials, measurements, inscriptions, distinguishing_features, title, subject, date_period, maker) makes a record identifiable if the object is lost or stolen.',
    fields: {
      schema: `must equal ${LOT_SCHEMA}`,
      id: 'optional stable identifier, ≤120 chars',
      object: 'the Object ID core: type, title (one of the two required), maker, maker_dates, date_period, materials[], measurements[{dimension, value, unit: cm|mm|m|in|ft|kg|g|lb}] (length units gain normalized_cm), inscriptions, distinguishing_features, subject, edition',
      heading: '{display, qualifier_code} — qualifier_code from /api/trade/vocab/heading-qualifiers; warranty_bearing is computed from the vocabulary, never accepted from input',
      maker_names: 'multi-script names: [{value, script?, system?}] e.g. {value: "張大千", script: "Hani"}, {value: "Zhang Daqian", system: "pinyin"}',
      estimate: '{low, high, currency(ISO3)} — currency is required, low ≤ high',
      reserve_exists: 'true | false | null (unknown) — never the reserve amount, which is confidential',
      lifecycle: 'enum from /api/trade/vocab/lot-lifecycle',
      availability: 'enum from /api/trade/vocab/gallery-availability (the fair-holds state machine)',
      settlement: '{status (required): enum from /api/trade/vocab/settlement-status, measured_at: YYYY-MM-DD (real calendar date)} — sold is not a boolean',
      compliance_flags: '{species_materials[] (ids from /api/trade/gates), made_before, arr_candidate, export_gate_candidates[]}',
      provenance: '{display_string} — parsed against aam-provenance/1 with warnings; parsed events echoed back',
      condition_note: 'free text ≤2000 — there is no industry-standard condition schema yet; a versioned one is planned with practitioner input',
      fee_schedule_ref: 'optional id from /api/trade/fees, tying the record to the rate card it sold under',
      rights: '{license, credit, note}',
    },
    csv_door: {
      content_type: 'text/csv',
      max_rows: MAX_CSV_ROWS,
      header_vocabulary: 'Artlogic import-template names (verified from public Artlogic documentation) plus Art Galleria / Artwork Archive variants — e.g. Artist, Title, Year, Medium, Dimensions, Stock number, Retail currency, Retail price, Status, Availability, Provenance, Condition. Matching is case- and punctuation-insensitive.',
      coercions: 'Dimensions text like "73.7 x 68.6 cm" parses as height × width (× depth); Retail price maps to estimate low = high with a note; Artlogic Availability/Status map to gallery-availability states. Every coercion is reported per row; rows then pass the same strict validator as JSON.',
      privacy: 'Living-party columns (Current owner, Sold to, Consigned by, Consultant, Client name, Buyer and their close variants) are deliberately ignored and reported per row; every other unmapped column is dropped without entering any record — an open validator must not carry owner or buyer identities.',
    },
    non_capabilities: nonCapabilityBlock({ validated: false }),
    disclosure: DISCLOSURE,
  };
}

function provenanceGrammar() {
  return {
    schema: PROV_SCHEMA,
    grammar: PROV_GRAMMAR,
    purpose: 'Round-trip between provenance display paragraphs and structured event chains. POST {display_string} to parse, or {events} to generate the display string. Nothing is stored.',
    rules: [
      { rule: 'A semicolon closing an ownership period means the work passed DIRECTLY to the next party.', status: 'verified', source: 'https://www.museumprovenance.org/reference/standard/' },
      { rule: 'A period closing an ownership period means a direct transfer is NOT known to have occurred. When uncertain, the convention assumes not-direct.', status: 'verified', source: 'https://www.museumprovenance.org/reference/standard/' },
      { rule: 'Parentheses around an ownership period mark a dealer, auction house, or agent rather than a private owner.', status: 'verified-with-variance', source: 'AAM/CMOA/Getty CDWA convention. VARIANCE: NCMA and LACMA use square brackets for dealers instead — bracket-vs-parenthesis meaning is institution-specific; only the semicolon/period semantics are universal across surveyed institutions.' },
      { rule: 'Square brackets carry life dates [1880-1955] (open-ended and ? forms allowed), numeric footnote markers [1] (max one per period), and letter citation markers [a].', status: 'verified', source: 'https://www.museumprovenance.org/reference/standard/' },
      { rule: 'A question mark marks element-level uncertainty (name?, location?, date?); "Possibly"/"Probably" opening a period marks whole-period uncertainty.', status: 'verified', source: 'https://www.museumprovenance.org/reference/standard/' },
      { rule: 'Acquisition-method phrases precede the acquiring party: purchased by, by descent to, by inheritance to, gift to, bequest to, transferred to, sold to, commissioned by.', status: 'verified', source: 'https://www.museumprovenance.org/reference/acquisition_methods/' },
      { rule: '"X for Y" after a purchase = X is the agent, Y the acquirer; "from Z" introduces the seller or seller\'s agent; named sales appear in quotation marks.', status: 'verified', source: 'https://www.museumprovenance.org/reference/standard/' },
    ],
    parser_honesty: 'The parser targets the AAM/CMOA convention above, best-effort. Text it does not recognize is preserved inside party.display or location rather than dropped — absorbed, not warned about — so confidence levels are heuristic and a "high" event can still carry unrecognized text in those fields. parse_warnings fire on structural anomalies (empty clauses, marker misuse), and the original display_string is always preserved and hash-covered. Regeneration from events is canonical-form, so round_trip_exact may be false for valid inputs.',
    privacy: 'Parsed party names are echoed back to the caller only — never stored, never resolved to identities. For living private parties prefer the Getty convention: "Private collection, <region>".',
    non_capabilities: nonCapabilityBlock({ validated: false }),
    disclosure: DISCLOSURE,
  };
}

function resultsContractAndCorpus(trade) {
  const corpus = trade.results || [];
  const houses = [...new Set(corpus.map(r => r.house))];
  const lotCount = corpus.reduce((n, r) => n + (r.lots || []).length, 0);
  return {
    schema: RESULTS_SCHEMA,
    canonicalization: TRADE_CANONICALIZATION,
    purpose: 'The voluntary results corpus. Houses submit their own results; consideration is open distribution, attribution, and deep links routing bidders back to the house. Never scraped — voluntary submission is the only legally clean sourcing channel.',
    contract: {
      house: 'lowercase kebab-case slug',
      sale: '{name, location, date: YYYY-MM-DD, currency: ISO3}',
      price_basis: 'REQUIRED: "hammer" or "premium_inclusive". Houses publish premium-inclusive ("Price realised", "Lot Sold", "Sold For", "Sold for £X inc. premium" — verified across the four majors) and do not publish hammer per lot, and Sotheby\'s says only "customarily" — so the basis must be declared per submission, never inferred from the house. premium_inclusive means the published buyer-side total excluding taxes.',
      lots: `[{lot_number, outcome: sold|bought_in|withdrawn|post_sale_sold, price (sold lots; or price_withheld: true for "Price on request" — sold lots only), currency?, maker?, title?, heading_display?}] — max ${MAX_RESULT_LOTS} per submission. Identification facts only; verbatim catalogue prose must not be submitted (it is the house's copyright).`,
      persistence: 'POST validates and witnesses only. Persistence is a pull request appending the normalized record to the "results" array in trade.json — the same array this GET serves.',
    },
    coverage: {
      sales: corpus.length,
      lots: lotCount,
      houses,
      note: corpus.length === 0
        ? 'The corpus is currently EMPTY. That is stated plainly rather than padded: results appear here only through voluntary submission, never scraping. Be the first — POST a past sale and it becomes openly citable with deep links home.'
        : `Coverage is partial and voluntary: ${corpus.length} sale(s), ${lotCount} lot(s), ${houses.length} house(s). Absence of a sale means nobody submitted it, not that it did not happen.`,
    },
    non_capabilities: nonCapabilityBlock({ validated: false }),
    disclosure: DISCLOSURE,
  };
}

// ── POST handlers ─────────────────────────────────────────────────
async function handleLotsPost(trade, request) {
  const body = await readTradeBody(request, { maxBytes: MAX_JSON_BYTES });
  if (body.error) return body.error;

  if (body.kind === 'json') {
    let parsed;
    try { parsed = JSON.parse(body.text); } catch {
      return tradeError('invalid_json', 'Request body must be valid JSON.', 400);
    }
    const { issues, record, warnings } = validateLot(parsed, trade);
    if (issues.length > 0) {
      return tradeError('validation_failed', `The record does not conform to ${LOT_SCHEMA}.`, 422, issues);
    }
    const contentHash = `sha256:${await sha256(canonicalJson(record))}`;
    return new Response(JSON.stringify({
      schema: TRADE_WITNESS_SCHEMA,
      record_schema: LOT_SCHEMA,
      canonicalization: TRADE_CANONICALIZATION,
      content_hash: contentHash,
      witnessed_at: new Date().toISOString(),
      record,
      validation_warnings: warnings,
      privacy_note: 'No lot data is stored or logged by the application. This is inventory data — carry the normalized record and receipt in your own systems.',
      ...nonCapabilityBlock(),
      disclosure: DISCLOSURE,
    }, null, 2), { status: 202, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store, max-age=0' } });
  }

  // CSV door
  const rows = parseCsv(body.text);
  if (rows.length < 2) return tradeError('empty_csv', 'CSV needs a header row and at least one data row.', 400);
  if (rows.length - 1 > MAX_CSV_ROWS) return tradeError('too_many_rows', `CSV must contain at most ${MAX_CSV_ROWS} data rows.`, 413);
  const headers = rows[0].map(h => ({ original: h.trim(), norm: normHeader(h) }));
  const unmapped = headers.filter(h => h.norm && !CSV_HEADER_MAP[h.norm] && !CSV_IGNORED_PRIVACY.has(h.norm)).map(h => h.original);
  const results = [];
  for (let r = 1; r < rows.length; r += 1) {
    const { lot, mappingNotes } = coerceCsvRow(headers, rows[r], trade);
    const { issues, record, warnings } = validateLot(lot, trade);
    const entry = { row: r, ok: issues.length === 0, mapping_notes: mappingNotes };
    if (issues.length === 0) {
      entry.record = record;
      entry.content_hash = `sha256:${await sha256(canonicalJson(record))}`;
      if (warnings.length) entry.validation_warnings = warnings;
    } else {
      entry.issues = issues;
    }
    results.push(entry);
  }
  const okCount = results.filter(e => e.ok).length;
  return new Response(JSON.stringify({
    schema: TRADE_WITNESS_SCHEMA,
    record_schema: LOT_SCHEMA,
    canonicalization: TRADE_CANONICALIZATION,
    witnessed_at: new Date().toISOString(),
    csv: {
      rows: rows.length - 1,
      valid: okCount,
      invalid: rows.length - 1 - okCount,
      unmapped_headers: unmapped,
      note: unmapped.length ? 'Unmapped columns were ignored; see the header vocabulary at GET /api/trade/lots.' : undefined,
    },
    results,
    privacy_note: 'No lot data is stored or logged by the application. Living-party columns (Current owner, Sold to, …) are deliberately ignored.',
    ...nonCapabilityBlock(),
    disclosure: DISCLOSURE,
  }, null, 2), { status: 202, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store, max-age=0' } });
}

// Strict validation of one caller-supplied provenance event: adversarial
// shapes must 422 with issues, never crash the generator.
const PROV_EVENT_FIELDS = new Set(['seq', 'party', 'period_certainty', 'method', 'date', 'location', 'location_certainty', 'footnote', 'citations', 'transfer_from_previous', 'named_event', 'source', 'confidence']);
const PROV_PARTY_FIELDS = new Set(['display', 'role', 'name_certainty', 'life_dates', 'relationship', 'agent']);
const PROV_METHOD_IDS = new Set(['purchase', 'inheritance', 'descent', 'gift', 'bequest', 'transfer', 'sale', 'acquisition', 'commission', 'consignment']);

function validateProvenanceEvent(e, path, issues) {
  if (!isJsonObject(e)) { issues.push(issue(path, 'wrong_type', 'must be an object')); return null; }
  rejectUnknown(e, PROV_EVENT_FIELDS, path, issues, PROV_SCHEMA);
  const out = {};
  if (!isJsonObject(e.party)) {
    issues.push(issue(`${path}.party`, 'required', 'must be an object with display'));
  } else {
    rejectUnknown(e.party, PROV_PARTY_FIELDS, `${path}.party`, issues, PROV_SCHEMA);
    out.party = {
      display: normText(e.party.display, `${path}.party.display`, issues, { max: 300, required: true }),
      role: normText(e.party.role, `${path}.party.role`, issues, { max: 40 }),
      name_certainty: normText(e.party.name_certainty, `${path}.party.name_certainty`, issues, { max: 20 }),
      relationship: normText(e.party.relationship, `${path}.party.relationship`, issues, { max: 120 }),
      agent: normText(e.party.agent, `${path}.party.agent`, issues, { max: 200 }),
    };
    if (e.party.life_dates !== undefined) {
      if (!isJsonObject(e.party.life_dates)) issues.push(issue(`${path}.party.life_dates`, 'wrong_type', 'must be {born, died}'));
      else out.party.life_dates = {
        born: e.party.life_dates.born === null ? null : normText(e.party.life_dates.born, `${path}.party.life_dates.born`, issues, { max: 10 }),
        died: e.party.life_dates.died === null ? null : normText(e.party.life_dates.died, `${path}.party.life_dates.died`, issues, { max: 10 }),
      };
    }
  }
  const period = normText(e.period_certainty, `${path}.period_certainty`, issues, { max: 20 });
  if (period && period !== 'possibly' && period !== 'probably') issues.push(issue(`${path}.period_certainty`, 'unsupported_value', 'must be possibly or probably'));
  if (period) out.period_certainty = period;
  const method = normText(e.method, `${path}.method`, issues, { max: 20 });
  if (method && !PROV_METHOD_IDS.has(method)) issues.push(issue(`${path}.method`, 'unsupported_value', `must be one of ${[...PROV_METHOD_IDS].join(', ')}`));
  if (method) out.method = method;
  if (e.date !== undefined) {
    if (!isJsonObject(e.date)) issues.push(issue(`${path}.date`, 'wrong_type', 'must be an object with text'));
    else out.date = {
      text: normText(e.date.text, `${path}.date.text`, issues, { max: 60, required: true }),
      qualifier: normText(e.date.qualifier, `${path}.date.qualifier`, issues, { max: 20 }),
    };
  }
  out.location = normText(e.location, `${path}.location`, issues, { max: 200 });
  out.footnote = normText(e.footnote, `${path}.footnote`, issues, { max: 4 });
  if (e.citations !== undefined) {
    if (!Array.isArray(e.citations)) issues.push(issue(`${path}.citations`, 'wrong_type', 'must be an array of letters'));
    else out.citations = e.citations.slice(0, 12).map((c, i) => normText(c, `${path}.citations[${i}]`, issues, { max: 2 })).filter(Boolean);
  }
  const transfer = e.transfer_from_previous;
  if (transfer !== undefined && transfer !== null && transfer !== 'direct' && transfer !== 'not_known_direct') {
    issues.push(issue(`${path}.transfer_from_previous`, 'unsupported_value', 'must be direct, not_known_direct, or null'));
  } else if (transfer !== undefined) {
    out.transfer_from_previous = transfer;
  }
  out.named_event = normText(e.named_event, `${path}.named_event`, issues, { max: 200 });
  out.source = normText(e.source, `${path}.source`, issues, { max: 200 });
  return out;
}

async function handleProvenancePost(trade, request) {
  const body = await readTradeBody(request, { maxBytes: MAX_JSON_BYTES });
  if (body.error) return body.error;
  if (body.kind !== 'json') return tradeError('unsupported_media_type', 'Provenance round-trips take application/json.', 415);
  let parsed;
  try { parsed = JSON.parse(body.text); } catch {
    return tradeError('invalid_json', 'Request body must be valid JSON.', 400);
  }
  if (!isJsonObject(parsed)) return tradeError('validation_failed', 'Body must be {display_string} or {events}.', 422);
  const issues = [];
  rejectUnknown(parsed, new Set(['display_string', 'events']), '$', issues, PROV_SCHEMA);
  if (issues.length) return tradeError('validation_failed', 'Unknown fields present.', 422, issues);

  if (parsed.display_string !== undefined) {
    const display = normText(parsed.display_string, '$.display_string', issues, { max: 8000, required: true });
    if (issues.length) return tradeError('validation_failed', 'display_string invalid.', 422, issues);
    const chain = parseProvenance(display);
    const regenerated = generateProvenance(chain.events);
    // the record IS the hash preimage — 'recompute from the normalized record'
    // must be literally true
    const record = { schema: PROV_SCHEMA, grammar: PROV_GRAMMAR, display_string: display, events: chain.events };
    const contentHash = `sha256:${await sha256(canonicalJson(record))}`;
    return new Response(JSON.stringify({
      record,
      parse_warnings: chain.parse_warnings,
      regenerated,
      round_trip_exact: regenerated === display,
      content_hash: contentHash,
      content_hash_preimage: 'the record field, canonicalized',
      canonicalization: TRADE_CANONICALIZATION,
      witnessed_at: new Date().toISOString(),
      ...nonCapabilityBlock(),
      disclosure: DISCLOSURE,
    }, null, 2), { status: 202, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store, max-age=0' } });
  }

  if (parsed.events !== undefined) {
    if (!Array.isArray(parsed.events)) {
      return tradeError('validation_failed', 'events must be an array.', 422, [issue('$.events', 'wrong_type', 'must be an array of events')]);
    }
    if (parsed.events.length === 0 || parsed.events.length > 60) {
      return tradeError('validation_failed', 'events must contain 1-60 entries.', 422, [issue('$.events', 'out_of_range', 'must contain 1-60 entries')]);
    }
    const events = parsed.events.map((e, i) => validateProvenanceEvent(e, `$.events[${i}]`, issues)).filter(Boolean);
    if (issues.length) return tradeError('validation_failed', 'events invalid.', 422, issues);
    const display = generateProvenance(events);
    const record = { schema: PROV_SCHEMA, grammar: PROV_GRAMMAR, display_string: display, events };
    const contentHash = `sha256:${await sha256(canonicalJson(record))}`;
    return new Response(JSON.stringify({
      record,
      content_hash: contentHash,
      content_hash_preimage: 'the record field, canonicalized',
      canonicalization: TRADE_CANONICALIZATION,
      witnessed_at: new Date().toISOString(),
      ...nonCapabilityBlock(),
      disclosure: DISCLOSURE,
    }, null, 2), { status: 202, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store, max-age=0' } });
  }

  return tradeError('validation_failed', 'Body must carry display_string (to parse) or events (to generate).', 422, [issue('$', 'required', 'one of display_string or events is required')]);
}

async function handleResultsPost(trade, request) {
  const body = await readTradeBody(request, { maxBytes: MAX_CSV_BYTES });
  if (body.error) return body.error;
  if (body.kind !== 'json') return tradeError('unsupported_media_type', 'Results submissions take application/json.', 415);
  let parsed;
  try { parsed = JSON.parse(body.text); } catch {
    return tradeError('invalid_json', 'Request body must be valid JSON.', 400);
  }
  const { issues, record } = validateResults(parsed, trade);
  if (issues.length > 0) {
    return tradeError('validation_failed', `The submission does not conform to ${RESULTS_SCHEMA}.`, 422, issues);
  }
  const contentHash = `sha256:${await sha256(canonicalJson(record))}`;
  return new Response(JSON.stringify({
    schema: TRADE_WITNESS_SCHEMA,
    record_schema: RESULTS_SCHEMA,
    canonicalization: TRADE_CANONICALIZATION,
    content_hash: contentHash,
    witnessed_at: new Date().toISOString(),
    record,
    consideration: {
      what_you_get: 'Open distribution under your attribution, and deep links routing bidders back to your sale pages. No toll, no take-rate, no keys.',
      what_we_never_do: 'Scrape your site, republish your catalogue prose, or serve your clients\' identities.',
    },
    next_steps: [
      'Append the normalized record above to the "results" array in trade.json (and its mirror dist/trade.json) — that array is exactly what GET /api/trade/results serves',
      'Open a pull request at https://github.com/cambridgetcg/artbitrage with that change, referencing this receipt\'s content_hash',
      'On merge and redeploy, the sale appears at GET /api/trade/results with attribution and deep links',
    ],
    ...nonCapabilityBlock(),
    disclosure: DISCLOSURE,
  }, null, 2), { status: 202, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store, max-age=0' } });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = Object.fromEntries(url.searchParams);
  const segments = url.pathname.split('/').map(s => decodeURIComponent(s)).filter(Boolean).slice(2);

  if (segments.length === 0) return directoryResponse();

  const trade = await loadTrade(env, request);
  if (!trade) return jsonResponse({ error: 'trade data unavailable', hint: 'trade.json could not be loaded' }, 503);

  const [head, tail] = segments;

  if (segments.length === 1) {
    if (head === 'fees') return handleFees(trade, q, request);
    if (head === 'rates') return handleRates(await loadRates(env, request));
    if (head === 'arr') return handleArr(trade, q, request);
    if (head === 'thresholds') return handleThresholds(trade, q);
    if (head === 'gates') return handleGates(trade, q, request);
    if (head === 'vocab') return handleVocab(trade, null);
    if (head === 'lots') return jsonResponse(lotsContract(), 200, 3600);
    if (head === 'provenance') return jsonResponse(provenanceGrammar(), 200, 3600);
    if (head === 'results') return jsonResponse(resultsContractAndCorpus(trade), 200, 300);
  }

  if (segments.length === 2) {
    if (head === 'fees' && tail === 'compute') return handleFeesCompute(trade, await loadRates(env, request), q, request);
    if (head === 'vocab') return handleVocab(trade, safeString(tail, 60).toLowerCase());
  }

  return jsonResponse({ error: 'not found', path: url.pathname, endpoints: ENDPOINTS }, 404);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const segments = url.pathname.split('/').map(s => decodeURIComponent(s)).filter(Boolean).slice(2);

  const trade = await loadTrade(env, request);
  if (!trade) return tradeError('data_unavailable', 'trade.json could not be loaded.', 503);

  try {
    if (segments.length === 1) {
      if (segments[0] === 'lots') return await handleLotsPost(trade, request);
      if (segments[0] === 'provenance') return await handleProvenancePost(trade, request);
      if (segments[0] === 'results') return await handleResultsPost(trade, request);
    }
    return tradeError('not_found', 'POST is accepted at /api/trade/lots, /api/trade/provenance, and /api/trade/results.', 404);
  } catch (err) {
    return tradeError('internal_error', 'The request could not be processed. Nothing was stored.', 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
