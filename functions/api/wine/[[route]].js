// ARTBITRAGE /api/wine/* — the wine vertical, served from wine.json
// Serverless API running on Cloudflare Pages Functions.
// The bare directory (GET /api/wine) is handled by functions/api/wine.js,
// but this router answers it too in case routing sends it here.

const VERTICAL = 'wine';
const TITLE = 'Wine — The Long Trade of Sun and Time';
const ESSENCE = 'Wine is the arbitrage between sunlight and time. Fermentation is the bridge.';
const MAX_SEARCH_LIMIT = 100;

const ENDPOINTS = [
  { method: 'GET', path: '/api/wine', desc: 'This directory' },
  { method: 'GET', path: '/api/wine/story', desc: 'Zero to one: eight chapters of how wine came into being' },
  { method: 'GET', path: '/api/wine/regions', desc: "The world's great wine regions" },
  { method: 'GET', path: '/api/wine/brands', desc: 'Iconic wine houses and estates' },
  { method: 'GET', path: '/api/wine/brands/:id', desc: 'One house by id, e.g. /api/wine/brands/krug' },
  { method: 'GET', path: '/api/wine/collections', desc: 'Curated groupings of houses' },
  { method: 'GET', path: '/api/wine/collections/:id', desc: 'One collection, its brand ids resolved to full brand objects' },
  { method: 'GET', path: '/api/wine/stores', desc: 'Fine-wine merchants of the world' },
  { method: 'GET', path: '/api/wine/process', desc: 'Earth to glass in ten stages' },
  { method: 'GET', path: '/api/wine/fermentation', desc: 'The science, vessels and notes of the bridge itself' },
  { method: 'GET', path: '/api/wine/selection', desc: 'How to choose a bottle: vintage, region, producer, price' },
  { method: 'GET', path: '/api/wine/aromas', desc: 'The aroma families — fruit, then craft, then time' },
  { method: 'GET', path: '/api/wine/techniques', desc: 'Winemaking techniques and their effects' },
  { method: 'GET', path: '/api/wine/formats', desc: 'Bottle formats from Piccolo to Nebuchadnezzar' },
  { method: 'GET', path: '/api/wine/random', desc: 'A random house, full object including its why' },
  { method: 'GET', path: '/api/wine/search?q=', desc: 'Case-insensitive search across brands, regions, stores and techniques' },
];

// Embedded wine data — loaded once per isolate from wine.json
let WINE = null;

// Load wine.json from static assets via env.ASSETS, with a plain-fetch fallback
async function loadWine(env, request) {
  if (WINE) return WINE;
  try {
    const assetUrl = new URL('/wine.json', request.url);
    const res = await env.ASSETS.fetch(assetUrl);
    if (res.ok) {
      WINE = await res.json();
      return WINE;
    }
  } catch(e) {
    // Fallback: try direct fetch
    try {
      const res2 = await fetch(new URL('/wine.json', request.url));
      if (res2.ok) {
        WINE = await res2.json();
        return WINE;
      }
    } catch(e2) {}
  }
  return WINE;
}

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

// True when any string field (or string inside an array field) contains the needle
function matchesQuery(item, needle) {
  return Object.values(item || {}).some(v => {
    if (typeof v === 'string') return v.toLowerCase().includes(needle);
    if (Array.isArray(v)) return v.some(x => typeof x === 'string' && x.toLowerCase().includes(needle));
    return false;
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams);

  // Segments after /api/wine — e.g. /api/wine/brands/krug → ['brands', 'krug']
  const segments = url.pathname.split('/').map(s => decodeURIComponent(s)).filter(Boolean).slice(2);

  // Defensive: bare /api/wine (or /api/wine/) routed here → same directory as functions/api/wine.js
  if (segments.length === 0) return directoryResponse();

  const wine = await loadWine(env, request);
  if (!wine) return jsonResponse({ error: 'wine data unavailable', hint: 'wine.json could not be loaded' }, 503);

  const [head, tail] = segments;

  if (segments.length === 1) {
    if (head === 'story') return jsonResponse(wine.story);
    if (head === 'regions') return jsonResponse({ regions: wine.regions || [], count: (wine.regions || []).length });
    if (head === 'brands') return jsonResponse({ brands: wine.brands || [], count: (wine.brands || []).length });
    if (head === 'collections') return jsonResponse({ collections: wine.collections || [], count: (wine.collections || []).length });
    if (head === 'stores') return jsonResponse({ stores: wine.stores || [], count: (wine.stores || []).length });
    if (head === 'process') return jsonResponse(wine.process);
    if (head === 'fermentation') return jsonResponse(wine.fermentation);
    if (head === 'selection') return jsonResponse(wine.selection);
    if (head === 'aromas') return jsonResponse(wine.aromas);
    if (head === 'techniques') return jsonResponse({ techniques: wine.techniques || [], count: (wine.techniques || []).length });
    if (head === 'formats') return jsonResponse({ formats: wine.formats || [], count: (wine.formats || []).length });

    if (head === 'random') {
      const brands = wine.brands || [];
      if (brands.length === 0) return jsonResponse({ error: 'no brands available' }, 404);
      return jsonResponse(brands[Math.floor(Math.random() * brands.length)]);
    }

    if (head === 'search') {
      const q = safeString(queryParams.q, 160);
      if (!q) return jsonResponse({ error: 'q is required', hint: 'GET /api/wine/search?q=riesling' }, 400);
      const limit = boundedInt(queryParams.limit, 20, 1, MAX_SEARCH_LIMIT);
      const needle = q.toLowerCase();
      const results = {
        brands: (wine.brands || []).filter(b => matchesQuery(b, needle)).slice(0, limit),
        regions: (wine.regions || []).filter(r => matchesQuery(r, needle)).slice(0, limit),
        stores: (wine.stores || []).filter(s => matchesQuery(s, needle)).slice(0, limit),
        techniques: (wine.techniques || []).filter(t => matchesQuery(t, needle)).slice(0, limit),
      };
      const count = results.brands.length + results.regions.length + results.stores.length + results.techniques.length;
      return jsonResponse({ query: q, results, count });
    }
  }

  if (segments.length === 2 && head === 'brands') {
    const id = tail.toLowerCase();
    const brand = (wine.brands || []).find(b => b.id === id);
    if (brand) return jsonResponse(brand);
    return jsonResponse({ error: 'brand not found', id: tail, valid_ids: (wine.brands || []).map(b => b.id) }, 404);
  }

  if (segments.length === 2 && head === 'collections') {
    const collection = (wine.collections || []).find(c => c.id === tail.toLowerCase());
    if (!collection) return jsonResponse({ error: 'collection not found', id: tail, valid_ids: (wine.collections || []).map(c => c.id) }, 404);
    const brandsById = new Map((wine.brands || []).map(b => [b.id, b]));
    const brands = (collection.brands || []).map(id => brandsById.get(id) || { id, error: 'brand not found' });
    return jsonResponse({ ...collection, brands, count: brands.length });
  }

  return jsonResponse({ error: 'not found', path: url.pathname, endpoints: ENDPOINTS }, 404);
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
