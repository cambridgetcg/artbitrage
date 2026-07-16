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
  { method: 'GET', path: '/api/trade/fees/compute', desc: 'All-in buyer cost: marginal band math, line items, schedule_applied, explicit not_included', params: 'hammer, currency, house, location, category, as_of' },
  { method: 'GET', path: '/api/trade/arr', desc: "Artist's Resale Right royalty: cumulative bands, cap status, liable society", params: 'price, currency=EUR, sale_date, artist_death_year, jurisdiction' },
  { method: 'GET', path: '/api/trade/thresholds', desc: 'Dated compliance constants (AML, export, import, VAT) with source_url per entry', params: 'jurisdiction, kind' },
  { method: 'GET', path: '/api/trade/gates', desc: 'Does this object cross a licensing/compliance gate — one call, each gate citing its regulation', params: 'year, value, currency, jurisdiction, materials, category' },
  { method: 'GET', path: '/api/trade/vocab', desc: 'Trade vocabularies: lot lifecycle, settlement status, heading-qualifier ladder, catalogue symbols, gallery availability' },
  { method: 'GET', path: '/api/trade/vocab/:id', desc: 'One vocabulary by id, e.g. /api/trade/vocab/heading-qualifiers' },
];

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

function parseIsoDate(value, fallback) {
  const s = safeString(value, 10);
  if (!s) return fallback;
  return ISO_DATE.test(s) ? s : null;
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

function handleFeesCompute(trade, q, request) {
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
      hint: 'pass hammer in the salesroom currency; we do not convert exchange rates',
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

  return jsonResponse({
    schema: 'artbitrage.fee-computation/1',
    input: { hammer, currency: schedule.currency, house, location: schedule.location, category, as_of },
    schedule_applied: scheduleRef(schedule),
    line_items: premium.items,
    buyers_premium: premium.total,
    total_incl_premium: round2(hammer + premium.total),
    not_included: notIncluded,
    disclosure: DISCLOSURE,
  }, 200, 300);
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
    if (head === 'arr') return handleArr(trade, q, request);
    if (head === 'thresholds') return handleThresholds(trade, q);
    if (head === 'gates') return handleGates(trade, q, request);
    if (head === 'vocab') return handleVocab(trade, null);
  }

  if (segments.length === 2) {
    if (head === 'fees' && tail === 'compute') return handleFeesCompute(trade, q, request);
    if (head === 'vocab') return handleVocab(trade, safeString(tail, 60).toLowerCase());
  }

  return jsonResponse({ error: 'not found', path: url.pathname, endpoints: ENDPOINTS }, 404);
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
