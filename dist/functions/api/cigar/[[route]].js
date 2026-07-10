// ARTBITRAGE API — CIGAR vertical subroutes
// Serverless API running on Cloudflare Pages Functions
// Serves /api/cigar/* from the root cigar.json static asset

const MAX_SEARCH_LIMIT = 100;

const DIRECTORY = {
  vertical: "cigar",
  title: "Cigar — Patience Made Smoke",
  essence: "A cigar is the arbitrage between leaf and fire. Patience made smoke.",
  endpoints: [
    { method: "GET", path: "/api/cigar", desc: "This directory" },
    { method: "GET", path: "/api/cigar/story", desc: "From seed to smoke — the history of the cigar in chapters" },
    { method: "GET", path: "/api/cigar/regions", desc: "The great tobacco-growing regions of the world" },
    { method: "GET", path: "/api/cigar/brands", desc: "The great cigar houses" },
    { method: "GET", path: "/api/cigar/brands/:id", desc: "One brand by id, e.g. /api/cigar/brands/cohiba" },
    { method: "GET", path: "/api/cigar/collections", desc: "Curated collections of brands" },
    { method: "GET", path: "/api/cigar/collections/:id", desc: "One collection, its brand ids resolved to full brand objects" },
    { method: "GET", path: "/api/cigar/stores", desc: "Storied cigar shops of the world" },
    { method: "GET", path: "/api/cigar/process", desc: "Seed to smoke — the stages of making a cigar" },
    { method: "GET", path: "/api/cigar/fermentation", desc: "The pilón — the science, vessels, and notes of fermentation" },
    { method: "GET", path: "/api/cigar/selection", desc: "How to choose a cigar — the selection guide" },
    { method: "GET", path: "/api/cigar/aromas", desc: "The aroma families and where they come from" },
    { method: "GET", path: "/api/cigar/techniques", desc: "Craft techniques, from tapado to the triple cap" },
    { method: "GET", path: "/api/cigar/vitolas", desc: "The classic sizes and shapes" },
    { method: "GET", path: "/api/cigar/wrappers", desc: "Wrapper shades, from candela to oscuro" },
    { method: "GET", path: "/api/cigar/random", desc: "A random brand — the full object, why and all" },
    { method: "GET", path: "/api/cigar/search?q=", desc: "Case-insensitive search across brands, regions, stores, and techniques" },
  ],
};

// Module-level cache — loaded once per isolate from the static asset
let CIGAR = null;

// Load cigar.json from static assets via env.ASSETS, like the art router loads collection.json
async function loadCigar(env, request) {
  if (CIGAR) return CIGAR;
  try {
    const assetUrl = new URL('/cigar.json', request.url);
    const res = await env.ASSETS.fetch(assetUrl);
    if (res.ok) {
      CIGAR = await res.json();
      return CIGAR;
    }
  } catch(e) {
    // Fallback: try direct fetch
    try {
      const res2 = await fetch(new URL('/cigar.json', request.url));
      if (res2.ok) {
        CIGAR = await res2.json();
        return CIGAR;
      }
    } catch(e2) {}
  }
  return CIGAR;
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

// Case-insensitive substring match across an object's own string values
function textMatch(obj, needle) {
  return Object.values(obj).some(v => typeof v === 'string' && v.toLowerCase().includes(needle));
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const queryParams = Object.fromEntries(url.searchParams);

  // Defensive: if routing sends the bare vertical root here, serve the directory
  if (path === '/api/cigar') return jsonResponse(DIRECTORY);

  const data = await loadCigar(env, request);
  if (!data) return jsonResponse({ error: 'cigar data unavailable', hint: 'cigar.json could not be loaded' }, 503);

  if (path === '/api/cigar/story') return jsonResponse(data.story || {});
  if (path === '/api/cigar/regions') {
    const regions = data.regions || [];
    return jsonResponse({ regions, count: regions.length });
  }
  if (path === '/api/cigar/brands') {
    const brands = data.brands || [];
    return jsonResponse({ brands, count: brands.length });
  }
  if (path === '/api/cigar/collections') {
    const collections = data.collections || [];
    return jsonResponse({ collections, count: collections.length });
  }
  if (path === '/api/cigar/stores') {
    const stores = data.stores || [];
    return jsonResponse({ stores, count: stores.length });
  }
  if (path === '/api/cigar/process') return jsonResponse(data.process || {});
  if (path === '/api/cigar/fermentation') return jsonResponse(data.fermentation || {});
  if (path === '/api/cigar/selection') return jsonResponse(data.selection || {});
  if (path === '/api/cigar/aromas') return jsonResponse(data.aromas || {});
  if (path === '/api/cigar/techniques') {
    const techniques = data.techniques || [];
    return jsonResponse({ techniques, count: techniques.length });
  }
  if (path === '/api/cigar/vitolas') {
    const vitolas = data.vitolas || [];
    return jsonResponse({ vitolas, count: vitolas.length });
  }
  if (path === '/api/cigar/wrappers') {
    const wrappers = data.wrappers || [];
    return jsonResponse({ wrappers, count: wrappers.length });
  }

  // Route: /api/cigar/random — a random brand, full object incl why
  if (path === '/api/cigar/random') {
    const brands = data.brands || [];
    if (brands.length === 0) return jsonResponse({ error: 'no brands available' }, 404);
    return jsonResponse(brands[Math.floor(Math.random() * brands.length)]);
  }

  // Route: /api/cigar/search?q= — case-insensitive substring search
  if (path === '/api/cigar/search') {
    const q = safeString(queryParams.q, 160);
    if (!q) return jsonResponse({ error: 'q is required', example: '/api/cigar/search?q=havana' }, 400);
    const s = q.toLowerCase();
    const limit = boundedInt(queryParams.limit, 20, 1, MAX_SEARCH_LIMIT);
    const results = {
      brands: (data.brands || []).filter(b => textMatch(b, s)).slice(0, limit),
      regions: (data.regions || []).filter(r => textMatch(r, s)).slice(0, limit),
      stores: (data.stores || []).filter(st => textMatch(st, s)).slice(0, limit),
      techniques: (data.techniques || []).filter(t => textMatch(t, s)).slice(0, limit),
    };
    const count = results.brands.length + results.regions.length + results.stores.length + results.techniques.length;
    return jsonResponse({ query: q, results, count });
  }

  // Route: /api/cigar/brands/:id — one brand by id
  const brandMatch = path.match(/^\/api\/cigar\/brands\/([^/]+)$/);
  if (brandMatch) {
    const id = decodeURIComponent(brandMatch[1]).toLowerCase();
    const brand = (data.brands || []).find(b => b.id === id);
    if (brand) return jsonResponse(brand);
    return jsonResponse({ error: 'brand not found', id, valid_ids: (data.brands || []).map(b => b.id) }, 404);
  }

  // Route: /api/cigar/collections/:id — one collection, brand ids resolved to full brand objects
  const collectionMatch = path.match(/^\/api\/cigar\/collections\/([^/]+)$/);
  if (collectionMatch) {
    const id = decodeURIComponent(collectionMatch[1]).toLowerCase();
    const collection = (data.collections || []).find(c => c.id === id);
    if (!collection) {
      return jsonResponse({ error: 'collection not found', id, valid_ids: (data.collections || []).map(c => c.id) }, 404);
    }
    const brandById = new Map((data.brands || []).map(b => [b.id, b]));
    const brands = (collection.brands || []).map(bid => brandById.get(bid) || { id: bid, error: 'brand not found' });
    return jsonResponse({ ...collection, brands, brand_count: brands.length });
  }

  return jsonResponse({ error: 'not found', path, endpoints: DIRECTORY.endpoints }, 404);
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
