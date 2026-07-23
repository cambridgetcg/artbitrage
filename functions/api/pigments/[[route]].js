// ARTBITRAGE /api/pigments/* — the pigment/colour vertical, served from pigments.json
// The colours of art history as machine-readable, source-cited facts, plus an
// anachronism check whose asymmetry is honest and in-band on every response:
// a pigment that postdates a claim is evidence AGAINST it; a period-consistent
// palette proves NOTHING. No keys, no database, no funds, no take-rate.
//
// The bare directory (GET /api/pigments) is handled by functions/api/pigments.js,
// but this router answers it too in case routing sends it here.

const VERTICAL = 'pigments';
const TITLE = 'Pigments — the colours of art history, dated and cited';
const ESSENCE = 'What each colour is, when it first appears, and when it could not yet exist. A dating tool that argues only against a claim, never for it. No keys, no database, no funds, no take-rate.';

const DISCLOSURE = Object.freeze({
  informational_only: true,
  authentication_advice: false,
  not_authentication: 'A pigment that postdates the claimed date is strong evidence AGAINST authenticity; a period-consistent palette can NEVER prove authenticity. Real pigment identification needs lab analysis (XRF/Raman/cross-section); this endpoint only reasons over pigments you supply, using first-attested dates that themselves carry uncertainty.',
  note: 'Reference facts over cited pigment histories. Every factual record carries a truth_status (verified | source-declared | contested | unverified) and its source. Confirm against the primary source and real analysis before drawing a conclusion.',
});

const ENDPOINTS = [
  { method: 'GET', path: '/api/pigments', desc: 'This directory' },
  { method: 'GET', path: '/api/pigments (list)', desc: 'Paginated pigment list with filters', params: 'limit, offset, family, type, era, hazard, marker, q' },
  { method: 'GET', path: '/api/pigments/:id', desc: 'One full pigment record, e.g. /api/pigments/prussian-blue' },
  { method: 'GET', path: '/api/pigments/random', desc: 'One random pigment, full record' },
  { method: 'GET', path: '/api/pigments/families', desc: 'Colour families with member counts and ids' },
  { method: 'GET', path: '/api/pigments/vocab', desc: 'The vocabularies: families, types, eras, hazard levels, truth statuses' },
  { method: 'GET', path: '/api/pigments/anachronism', desc: 'Compare supplied pigments to a claimed date — anachronism / plausible / uncertain, per pigment, with the cited floor. Informational only; never proves authenticity.', params: 'pigments (comma-separated ids), claimed_date (year)' },
];

// Contiguous, non-overlapping era windows (art-history aligned). A pigment is
// "in use during" an era if it was attested by the era's end and not obsolete
// before the era's start. These windows are a convenience lens over the dates,
// not a claim about any single object.
const ERAS = [
  { id: 'prehistoric', label: 'Prehistoric', from: -40000, to: -3000 },
  { id: 'ancient', label: 'Ancient', from: -3000, to: 500 },
  { id: 'medieval', label: 'Medieval', from: 500, to: 1400 },
  { id: 'renaissance', label: 'Renaissance', from: 1400, to: 1600 },
  { id: 'baroque', label: 'Baroque', from: 1600, to: 1780 },
  { id: 'romantic-industrial', label: 'Romantic / early-industrial', from: 1780, to: 1870 },
  { id: 'modern', label: 'Modern', from: 1870, to: 1945 },
  { id: 'contemporary', label: 'Contemporary', from: 1945, to: 2100 },
];

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const MAX_ANACHRONISM_PIGMENTS = 50;

// Embedded pigment data — loaded once per isolate from pigments.json
let PIGMENTS = null;

async function loadPigments(env, request) {
  if (PIGMENTS) return PIGMENTS;
  try {
    const assetUrl = new URL('/pigments.json', request.url);
    const res = await env.ASSETS.fetch(assetUrl);
    if (res.ok) {
      PIGMENTS = await res.json();
      return PIGMENTS;
    }
  } catch (e) {
    try {
      const res2 = await fetch(new URL('/pigments.json', request.url));
      if (res2.ok) {
        PIGMENTS = await res2.json();
        return PIGMENTS;
      }
    } catch (e2) {}
  }
  return PIGMENTS;
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

function parseYear(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < -50000 || n > 3000) return null;
  return n;
}

function parseNonNegInt(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function directoryResponse() {
  return jsonResponse({ vertical: VERTICAL, title: TITLE, essence: ESSENCE, disclosure: DISCLOSURE, endpoints: ENDPOINTS }, 200, 3600);
}

// ── derived hazard (computed, never baked into the data) ──────────
// A coarse convenience tag over the honest free-text toxicity field, which
// remains the source of truth. Read from the leading verdict sentence.
const HAZARD_ELEMENTS = ['arsenic', 'mercury', 'lead', 'cadmium', 'cobalt', 'cyanide', 'bitumen'];

function hazardOf(p) {
  const tox = String(p.toxicity || '');
  const first = tox.split(/[.;]/)[0].toLowerCase().trim();
  let level;
  if (/extremely/.test(first)) level = 'severe';
  else if (/non-toxic|low/.test(first)) level = 'low';
  else if (/highly|high|toxic|poison/.test(first)) level = 'toxic';
  else level = 'low';
  const t = tox.toLowerCase();
  const tags = HAZARD_ELEMENTS.filter(el => t.includes(el));
  return { level, tags, basis: tox.split(/(?<=[.;])\s/)[0] || tox.slice(0, 160) };
}

// ── filters ───────────────────────────────────────────────────────
function typeMatch(p, q) {
  const type = String(p.type || '').toLowerCase();
  if (type === q) return true;
  return type.split(/[^a-z]+/).filter(Boolean).includes(q);
}

function firstYear(p) {
  return p.dates && p.dates.first_attested ? p.dates.first_attested.year : null;
}
function obsYear(p) {
  return p.dates && p.dates.obsolescence ? p.dates.obsolescence.year : null;
}

function inUseDuringEra(p, era) {
  const fy = firstYear(p);
  if (fy === null) return false;
  const oy = obsYear(p);
  return fy <= era.to && (oy === null || oy >= era.from);
}

function hazardMatch(p, q) {
  const h = hazardOf(p);
  if (q === 'toxic') return h.level !== 'low';
  if (q === 'severe') return h.level === 'severe';
  if (q === 'low' || q === 'safe') return h.level === 'low';
  return h.tags.includes(q);
}

function searchBlob(p) {
  const parts = [];
  parts.push((p.names || []).join(' '));
  parts.push(p.id, p.family, p.type, p.colour_index || '');
  if (p.origin) parts.push(p.origin.source, p.origin.geography);
  if (p.chemistry) parts.push(p.chemistry.composition, p.chemistry.formula);
  parts.push(p.production, p.lightfastness, p.toxicity, p.storage);
  (p.stories || []).forEach(s => parts.push(s.text));
  if (p.anachronism_marker) parts.push(p.anachronism_marker.note);
  return parts.filter(Boolean).join(' ').toLowerCase();
}

// ── projections ───────────────────────────────────────────────────
function dateBrief(d) {
  if (!d) return null;
  return { year: d.year, truth_status: d.truth_status, source_url: d.source_url };
}

function pigmentSummary(p) {
  return {
    id: p.id,
    name: (p.names && p.names[0]) || p.id,
    names: p.names,
    family: p.family,
    type: p.type,
    colour_index: p.colour_index,
    swatch: p.swatch,
    origin_source: p.origin ? p.origin.source : null,
    first_attested: dateBrief(p.dates && p.dates.first_attested),
    synthetic_from: dateBrief(p.dates && p.dates.synthetic_from),
    obsolescence: dateBrief(p.dates && p.dates.obsolescence),
    is_marker: !!(p.anachronism_marker && p.anachronism_marker.is_marker),
    hazard: hazardOf(p),
  };
}

// ── list ──────────────────────────────────────────────────────────
function handleList(data, q) {
  const all = data.pigments || [];
  const family = safeString(q.family, 40).toLowerCase();
  const type = safeString(q.type, 40).toLowerCase();
  const era = safeString(q.era, 40).toLowerCase();
  const hazard = safeString(q.hazard, 40).toLowerCase();
  const marker = safeString(q.marker, 10).toLowerCase();
  const text = safeString(q.q, 120).toLowerCase();

  const eraDef = era ? ERAS.find(e => e.id === era) : null;
  if (era && !eraDef) {
    return jsonResponse({ error: 'unknown era', era, valid_eras: ERAS.map(e => e.id), hint: 'GET /api/pigments/vocab lists eras with their year windows' }, 400);
  }

  let filtered = all.filter((p) => {
    if (family && p.family !== family) return false;
    if (type && !typeMatch(p, type)) return false;
    if (eraDef && !inUseDuringEra(p, eraDef)) return false;
    if (hazard && !hazardMatch(p, hazard)) return false;
    if ((marker === 'true' || marker === '1') && !(p.anachronism_marker && p.anachronism_marker.is_marker)) return false;
    if (marker === 'false' && p.anachronism_marker && p.anachronism_marker.is_marker) return false;
    if (text && !searchBlob(p).includes(text)) return false;
    return true;
  });

  const total = filtered.length;
  const limit = Math.min(parseNonNegInt(q.limit, DEFAULT_LIMIT), MAX_LIMIT);
  const offset = parseNonNegInt(q.offset, 0);
  const page = filtered.slice(offset, offset + limit);

  return jsonResponse({
    schema: 'artbitrage.pigments/1',
    total,
    count: page.length,
    limit,
    offset,
    filters_applied: {
      family: family || null,
      type: type || null,
      era: era || null,
      hazard: hazard || null,
      marker: marker || null,
      q: text || null,
    },
    pigments: page.map(pigmentSummary),
    disclosure: DISCLOSURE,
  }, 200, 3600);
}

function handleOne(data, id) {
  const p = (data.pigments || []).find(x => x.id === id);
  if (!p) {
    return jsonResponse({ error: 'pigment not found', id, valid_ids: (data.pigments || []).map(x => x.id) }, 404);
  }
  return jsonResponse({
    schema: 'artbitrage.pigments/1',
    pigment: { ...p, hazard: hazardOf(p) },
    swatch_note: data.swatch_note,
    disclosure: DISCLOSURE,
  }, 200, 3600);
}

function handleRandom(data) {
  const all = data.pigments || [];
  if (all.length === 0) return jsonResponse({ error: 'no pigments available' }, 503);
  const p = all[Math.floor(Math.random() * all.length)];
  return jsonResponse({
    schema: 'artbitrage.pigments/1',
    pigment: { ...p, hazard: hazardOf(p) },
    swatch_note: data.swatch_note,
    disclosure: DISCLOSURE,
  }, 200, 0);
}

function handleFamilies(data) {
  const all = data.pigments || [];
  const map = {};
  for (const p of all) {
    (map[p.family] = map[p.family] || []).push(p.id);
  }
  const families = Object.keys(map).sort().map(f => ({ family: f, count: map[f].length, ids: map[f] }));
  return jsonResponse({ schema: 'artbitrage.pigments/1', count: families.length, families, disclosure: DISCLOSURE }, 200, 3600);
}

function handleVocab(data) {
  const all = data.pigments || [];
  const families = [...new Set(all.map(p => p.family))].sort();
  const types = [...new Set(all.map(p => p.type))].sort();
  const hazardLevels = [
    { id: 'low', label: 'Low / effectively non-toxic' },
    { id: 'toxic', label: 'Toxic — real chemical hazard (lead, mercury, cobalt, cadmium…)' },
    { id: 'severe', label: 'Severe — extremely toxic (the arsenic greens)' },
  ];
  return jsonResponse({
    schema: 'artbitrage.pigments/1',
    vocabularies: {
      families,
      types: { values: types, note: "Filter ?type= matches whole tokens: ?type=mineral and ?type=synthetic-inorganic both reach vermilion, which is honestly dual-origin ('mineral-or-synthetic-inorganic')." },
      eras: ERAS,
      hazard_levels: hazardLevels,
      hazard_element_tags: HAZARD_ELEMENTS,
      truth_statuses: [
        { id: 'verified', desc: 'Corroborated by a strong/primary or peer-reviewed source' },
        { id: 'source-declared', desc: 'A source states it, but it is not independently corroborated here' },
        { id: 'contested', desc: 'Sources genuinely disagree; carried with the disagreement' },
        { id: 'unverified', desc: 'Recorded but not checked' },
      ],
      anachronism_verdicts: [
        { id: 'anachronism', desc: 'The pigment postdates the claimed date — it did not yet exist. Strong evidence AGAINST the claim.' },
        { id: 'plausible', desc: 'The pigment already existed by the claimed date. Consistent, but proves nothing on its own.' },
        { id: 'uncertain', desc: 'The pigment has no recorded first-attested year, so no comparison can be made.' },
      ],
    },
    disclosure: DISCLOSURE,
  }, 200, 3600);
}

// ── the anachronism computation ───────────────────────────────────
// For each supplied pigment: compare the claimed date to the pigment's
// first-attested floor (the earliest the material is attested at all). A claim
// before that floor is an anachronism. The synthetic sub-floor is surfaced as a
// caveat, never used to silently flip the verdict — because this endpoint cannot
// know which form (natural vs synthetic) a real object contains.
export function classifyPigment(p, claimedDate) {
  const fa = p.dates && p.dates.first_attested;
  const floorYear = fa ? fa.year : null;
  const sf = p.dates && p.dates.synthetic_from;
  const marker = p.anachronism_marker || {};

  const caveats = [];
  let verdict;
  let marginYears = null;

  if (floorYear === null) {
    verdict = 'uncertain';
    caveats.push('No first-attested year is recorded for this pigment, so no date comparison is possible.');
  } else {
    marginYears = claimedDate - floorYear;
    verdict = marginYears < 0 ? 'anachronism' : 'plausible';
    if (fa.truth_status !== 'verified') {
      caveats.push(`The first-attested floor (${floorYear}) is ${fa.truth_status}, not fully verified — the floor year itself carries uncertainty.`);
    }
  }

  // Dual-origin / synthetic sub-floor: if identifying the SYNTHETIC form would
  // raise the floor above the claimed date, that possibility is decisive only
  // with lab data — surface it honestly.
  let syntheticFloor = null;
  if (sf) {
    const raises = floorYear !== null && sf.year > floorYear;
    syntheticFloor = { year: sf.year, truth_status: sf.truth_status, source_url: sf.source_url, raises_floor: raises };
    if (raises && verdict === 'plausible' && claimedDate < sf.year) {
      caveats.push(`Material could be present as the older/natural form, but if lab analysis identifies the SYNTHETIC form, the floor rises to ${sf.year} and the claimed date ${claimedDate} would then be anachronistic.`);
    }
  }

  if (verdict === 'plausible') {
    caveats.push(marker.is_marker
      ? 'Period-consistent presence supports nothing on its own — even a strong marker pigment can only ever argue against a claim, not for it.'
      : 'Presence is period-consistent but only weakly constrains a date; this pigment is not a strong marker.');
  }

  return {
    id: p.id,
    name: (p.names && p.names[0]) || p.id,
    family: p.family,
    verdict,
    margin_years: marginYears,
    margin_note: marginYears === null ? null
      : (marginYears < 0
        ? `claimed date is ${Math.abs(marginYears)} year(s) BEFORE the pigment's first-attested floor`
        : `claimed date is ${marginYears} year(s) after the pigment's first-attested floor`),
    first_attested: dateBrief(fa),
    synthetic_floor: syntheticFloor,
    is_marker: !!marker.is_marker,
    marker_note: marker.note || null,
    caveats,
  };
}

function handleAnachronism(data, q) {
  const claimedDate = parseYear(q.claimed_date);
  if (claimedDate === null) {
    return jsonResponse({
      error: 'claimed_date is required and must be a year (negative for BCE, e.g. -1500)',
      hint: 'GET /api/pigments/anachronism?pigments=prussian-blue,titanium-white&claimed_date=1680',
    }, 400);
  }
  const raw = safeString(q.pigments, 800);
  if (!raw) {
    return jsonResponse({
      error: 'pigments is required — a comma-separated list of pigment ids',
      valid_ids: (data.pigments || []).map(p => p.id),
      hint: 'GET /api/pigments/anachronism?pigments=prussian-blue,titanium-white&claimed_date=1680',
    }, 400);
  }
  const ids = [...new Set(raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))].slice(0, MAX_ANACHRONISM_PIGMENTS);

  const byId = Object.fromEntries((data.pigments || []).map(p => [p.id, p]));
  const results = [];
  const unrecognized = [];
  for (const id of ids) {
    const p = byId[id];
    if (!p) { unrecognized.push(id); continue; }
    results.push(classifyPigment(p, claimedDate));
  }

  const anachronistic = results.filter(r => r.verdict === 'anachronism');
  const anyAnachronism = anachronistic.length > 0;
  let summary;
  if (results.length === 0) {
    summary = `No supplied pigment id was recognized. Nothing could be assessed against the claimed date ${claimedDate}.`;
  } else if (anyAnachronism) {
    summary = `${anachronistic.length} of ${results.length} supplied pigment(s) postdate the claimed date ${claimedDate} (${anachronistic.map(r => r.id).join(', ')}). Even one anachronistic pigment is strong evidence AGAINST the claim. A clean palette would still prove nothing.`;
  } else {
    summary = `All ${results.length} supplied pigment(s) already existed by the claimed date ${claimedDate}. The palette is period-consistent — which supports authenticity NOT AT ALL on its own. Only lab identification and the absence of any later pigment could argue further, and never conclusively for authenticity.`;
  }

  return jsonResponse({
    schema: 'artbitrage.pigment-anachronism/1',
    informational_only: true,
    not_authentication: DISCLOSURE.not_authentication,
    claimed_date: claimedDate,
    method: "Each pigment's first-attested year is the floor (earliest the material is attested). claimed_date < floor → anachronism; claimed_date >= floor → plausible; no recorded floor → uncertain. Synthetic sub-floors are surfaced as caveats, never used to flip a verdict, because this endpoint cannot know which form a real object contains.",
    results,
    unrecognized,
    overall: { any_anachronism: anyAnachronism, assessed: results.length, unrecognized_count: unrecognized.length, summary },
    disclosure: DISCLOSURE,
  }, 200, 300);
}

// ── router ────────────────────────────────────────────────────────
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = Object.fromEntries(url.searchParams);
  const segments = url.pathname.split('/').map(s => decodeURIComponent(s)).filter(Boolean).slice(2);

  const data = await loadPigments(env, request);
  if (!data) return jsonResponse({ error: 'pigment data unavailable', hint: 'pigments.json could not be loaded' }, 503);

  if (segments.length === 0) {
    // bare /api/pigments with query params → the filtered list; without → directory
    if (Object.keys(q).length > 0) return handleList(data, q);
    return directoryResponse();
  }

  const [head] = segments;

  if (segments.length === 1) {
    if (head === 'random') return handleRandom(data);
    if (head === 'families') return handleFamilies(data);
    if (head === 'vocab') return handleVocab(data);
    if (head === 'anachronism') return handleAnachronism(data, q);
    return handleOne(data, safeString(head, 120).toLowerCase());
  }

  return jsonResponse({ error: 'not found', path: url.pathname, endpoints: ENDPOINTS }, 404);
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
