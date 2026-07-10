// ARTBITRAGE /api/pair/* — the pairing vertical, served from pairings.json
// Serverless API running on Cloudflare Pages Functions.
// The bare directory (GET /api/pair) is handled by functions/api/pair.js,
// but this router answers it too in case routing sends it here.
//
// pairings.json contract:
// { name, title, essence,
//   principles: [{ id, principle, why }],
//   marriages:  [{ id, name, wine: { ref, style }, cigar: { ref, style }, why, occasion }],
//   cautions:   [{ id, pair, why_it_fights }],
//   ritual:     { essence, steps: [] } }
// A marriage's wine.ref / cigar.ref point at brand ids in wine.json / cigar.json (or null).

const VERTICAL = 'pair';
const TITLE = 'Pairing — The Marriage of Smoke and Wine';
const ESSENCE = 'A pairing is arbitrage between two finished arts: each supplies what the other lacks, and the marriage trades above its parts.';
const MAX_SEARCH_LIMIT = 100;

const ENDPOINTS = [
  { method: 'GET', path: '/api/pair', desc: 'This directory' },
  { method: 'GET', path: '/api/pair/principles', desc: 'The laws of pairing: why smoke and wine marry' },
  { method: 'GET', path: '/api/pair/marriages', desc: 'All wine-and-cigar marriages' },
  { method: 'GET', path: '/api/pair/marriages/:id', desc: 'One marriage by id, its wine and cigar refs resolved to full brand objects' },
  { method: 'GET', path: '/api/pair/cautions', desc: 'Pairings that fight, and why' },
  { method: 'GET', path: '/api/pair/ritual', desc: 'How to conduct the pairing, step by step' },
  { method: 'GET', path: '/api/pair/random', desc: 'A random marriage, refs resolved to full brand objects' },
  { method: 'GET', path: '/api/pair/for?wine=&cigar=', desc: 'Marriages matching a wine and/or cigar by id or keyword, resolved' },
  { method: 'GET', path: '/api/pair/search?q=', desc: 'Case-insensitive search across principles, marriages and cautions' },
];

// Embedded data — each loaded once per isolate from static assets
const CACHE = { pairings: null, wine: null, cigar: null };

// Load a JSON asset via env.ASSETS, with a plain-fetch fallback
async function loadJson(env, request, path, key) {
  if (CACHE[key]) return CACHE[key];
  try {
    const assetUrl = new URL(path, request.url);
    const res = await env.ASSETS.fetch(assetUrl);
    if (res.ok) {
      CACHE[key] = await res.json();
      return CACHE[key];
    }
  } catch(e) {
    // Fallback: try direct fetch
    try {
      const res2 = await fetch(new URL(path, request.url));
      if (res2.ok) {
        CACHE[key] = await res2.json();
        return CACHE[key];
      }
    } catch(e2) {}
  }
  return CACHE[key];
}

const loadPairings = (env, request) => loadJson(env, request, '/pairings.json', 'pairings');
const loadWine = (env, request) => loadJson(env, request, '/wine.json', 'wine');
const loadCigar = (env, request) => loadJson(env, request, '/cigar.json', 'cigar');

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function boundedInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeString(value, max = 10000) {
  return String(value || '').trim().slice(0, max);
}

function directoryResponse() {
  return jsonResponse({ vertical: VERTICAL, title: TITLE, essence: ESSENCE, endpoints: ENDPOINTS });
}

// Map brand id (lowercased) → full brand object, from wine.json / cigar.json
function brandMap(data) {
  return new Map(((data && data.brands) || []).map(b => [String(b.id || '').toLowerCase(), b]));
}

// Resolve one side of a marriage ({ ref, style }): keep ref and style labels,
// and attach the full brand object as `brand` when ref is non-null and known.
function resolveSide(side, brandsById) {
  if (!side || typeof side !== 'object') return side;
  const ref = typeof side.ref === 'string' ? side.ref : null;
  const brand = (ref && brandsById && brandsById.get(ref.toLowerCase())) || null;
  return { ...side, brand };
}

function resolveMarriage(marriage, wineBrands, cigarBrands) {
  return {
    ...marriage,
    wine: resolveSide(marriage.wine, wineBrands),
    cigar: resolveSide(marriage.cigar, cigarBrands),
  };
}

// Case-insensitive match of a needle against one side of a marriage:
// its ref, its style label, and the resolved brand's id, name and style.
function sideMatches(side, needle, brandsById) {
  if (!side || typeof side !== 'object') return false;
  const ref = typeof side.ref === 'string' ? side.ref.toLowerCase() : '';
  if (ref && ref.includes(needle)) return true;
  if (typeof side.style === 'string' && side.style.toLowerCase().includes(needle)) return true;
  const brand = ref && brandsById ? brandsById.get(ref) : null;
  if (brand) {
    return ['id', 'name', 'style'].some(k =>
      typeof brand[k] === 'string' && brand[k].toLowerCase().includes(needle));
  }
  return false;
}

// True when any string field (or string inside an array / one-level-deep object) contains the needle
function matchesQuery(item, needle) {
  return Object.values(item || {}).some(v => valueMatches(v, needle));
}

function valueMatches(v, needle) {
  if (typeof v === 'string') return v.toLowerCase().includes(needle);
  if (Array.isArray(v)) return v.some(x => valueMatches(x, needle));
  if (v && typeof v === 'object') {
    return Object.values(v).some(x => typeof x === 'string' && x.toLowerCase().includes(needle));
  }
  return false;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams);

  // Segments after /api/pair — e.g. /api/pair/marriages/m1 → ['marriages', 'm1']
  const segments = url.pathname.split('/').map(s => decodeURIComponent(s)).filter(Boolean).slice(2);

  // Defensive: bare /api/pair (or /api/pair/) routed here → same directory as functions/api/pair.js
  if (segments.length === 0) return directoryResponse();

  const pair = await loadPairings(env, request);
  if (!pair) return jsonResponse({ error: 'pairing data unavailable', hint: 'pairings.json could not be loaded' }, 503);

  const [head, tail] = segments;
  const marriages = pair.marriages || [];

  if (segments.length === 1) {
    if (head === 'principles') return jsonResponse({ principles: pair.principles || [], count: (pair.principles || []).length });
    if (head === 'marriages') return jsonResponse({ marriages, count: marriages.length });
    if (head === 'cautions') return jsonResponse({ cautions: pair.cautions || [], count: (pair.cautions || []).length });
    if (head === 'ritual') return jsonResponse(pair.ritual);

    if (head === 'random') {
      if (marriages.length === 0) return jsonResponse({ error: 'no marriages available' }, 404);
      const marriage = marriages[Math.floor(Math.random() * marriages.length)];
      const [wine, cigar] = await Promise.all([loadWine(env, request), loadCigar(env, request)]);
      return jsonResponse(resolveMarriage(marriage, brandMap(wine), brandMap(cigar)));
    }

    if (head === 'for') {
      const wineQ = safeString(queryParams.wine, 160).toLowerCase();
      const cigarQ = safeString(queryParams.cigar, 160).toLowerCase();
      if (!wineQ && !cigarQ) {
        return jsonResponse({ error: 'wine and/or cigar is required', hint: 'GET /api/pair/for?wine=krug or /api/pair/for?cigar=maduro or both' }, 400);
      }
      const [wine, cigar] = await Promise.all([loadWine(env, request), loadCigar(env, request)]);
      const wineBrands = brandMap(wine);
      const cigarBrands = brandMap(cigar);
      const matches = marriages.filter(m => {
        if (wineQ && !sideMatches(m.wine, wineQ, wineBrands)) return false;
        if (cigarQ && !sideMatches(m.cigar, cigarQ, cigarBrands)) return false;
        return true;
      });
      const resolved = matches.map(m => resolveMarriage(m, wineBrands, cigarBrands));
      return jsonResponse({ query: { wine: wineQ || null, cigar: cigarQ || null }, marriages: resolved, count: resolved.length });
    }

    if (head === 'search') {
      const q = safeString(queryParams.q, 160);
      if (!q) return jsonResponse({ error: 'q is required', hint: 'GET /api/pair/search?q=maduro' }, 400);
      const limit = boundedInt(queryParams.limit, 20, 1, MAX_SEARCH_LIMIT);
      const needle = q.toLowerCase();
      const results = {
        principles: (pair.principles || []).filter(p => matchesQuery(p, needle)).slice(0, limit),
        marriages: marriages.filter(m => matchesQuery(m, needle)).slice(0, limit),
        cautions: (pair.cautions || []).filter(c => matchesQuery(c, needle)).slice(0, limit),
      };
      const count = results.principles.length + results.marriages.length + results.cautions.length;
      return jsonResponse({ query: q, results, count });
    }
  }

  if (segments.length === 2 && head === 'marriages') {
    const id = tail.toLowerCase();
    const marriage = marriages.find(m => String(m.id || '').toLowerCase() === id);
    if (!marriage) return jsonResponse({ error: 'marriage not found', id: tail, valid_ids: marriages.map(m => m.id) }, 404);
    const [wine, cigar] = await Promise.all([loadWine(env, request), loadCigar(env, request)]);
    return jsonResponse(resolveMarriage(marriage, brandMap(wine), brandMap(cigar)));
  }

  return jsonResponse({ error: 'not found', path: url.pathname, endpoints: ENDPOINTS }, 404);
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
