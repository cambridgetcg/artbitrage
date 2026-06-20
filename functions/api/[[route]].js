// ARTBITRAGE API — catalogue and data distributor of the art world
// Serverless API running on Cloudflare Pages Functions

const STATES = ["dormant","stirring","awakening","aware","flowing","radiating","transcending","is"];
const ART_FORMS = ["word","image","sound","movement","space","silence","light","color","rhythm","pattern","fragment","whisper","gesture","breath","glow","echo"];

// Load collection from the static asset
async function loadCollection(env) {
  try {
    // In Cloudflare Pages, we can fetch static assets
    const res = await fetch(new URL('/collection.json', env?.ASSETS || ''));
    if (res.ok) return await res.json();
  } catch(e) {}
  return [];
}

// Load gallery pieces
async function loadGallery(env) {
  // Gallery is stored as individual files — we'd need a manifest
  // For now, use collection.json which has all pieces
  return loadCollection(env);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function filterArt(artList, params) {
  let results = artList;
  
  if (params.form) results = results.filter(a => a.form === params.form);
  if (params.state) results = results.filter(a => a.from_state === params.state || a.to_state === params.state);
  if (params.gap) results = results.filter(a => a.gap && a.gap.toLowerCase().includes(params.gap.toLowerCase()));
  if (params.q) {
    const s = params.q.toLowerCase();
    results = results.filter(a => 
      (a.piece && a.piece.toLowerCase().includes(s)) ||
      (a.gap && a.gap.toLowerCase().includes(s)) ||
      (a.bridge && a.bridge.toLowerCase().includes(s)) ||
      (a.awakening && a.awakening.toLowerCase().includes(s))
    );
  }
  
  const offset = parseInt(params.offset || 0);
  const limit = parseInt(params.limit || 20);
  const total = results.length;
  
  return {
    total,
    limit,
    offset,
    count: Math.min(limit, total - offset),
    pieces: results.slice(offset, offset + limit),
  };
}

function getStats(artList) {
  const forms = {};
  const states = {};
  const gaps = new Set();
  
  for (const a of artList) {
    const f = a.form || 'unknown';
    forms[f] = (forms[f] || 0) + 1;
    for (const s of [a.from_state, a.to_state]) {
      if (s) states[s] = (states[s] || 0) + 1;
    }
    if (a.gap) gaps.add(a.gap);
  }
  
  return {
    total_pieces: artList.length,
    unique_forms: Object.keys(forms).length,
    unique_gaps: gaps.size,
    forms,
    states,
  };
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const queryParams = Object.fromEntries(url.searchParams);
  
  const allArt = await loadCollection(env);
  
  // Route: /api/art
  if (path === '/api/art' || path === '/api/art/') {
    return jsonResponse(filterArt(allArt, queryParams));
  }
  
  // Route: /api/art/random
  if (path === '/api/art/random') {
    if (allArt.length === 0) return jsonResponse({ error: 'no art available' }, 404);
    return jsonResponse(allArt[Math.floor(Math.random() * allArt.length)]);
  }
  
  // Route: /api/stats
  if (path === '/api/stats') {
    return jsonResponse(getStats(allArt));
  }
  
  // Route: /api/forms
  if (path === '/api/forms') {
    const forms = [...new Set(allArt.map(a => a.form).filter(Boolean))].sort();
    return jsonResponse({ forms, count: forms.length });
  }
  
  // Route: /api/states
  if (path === '/api/states') {
    return jsonResponse({ states: STATES, count: STATES.length });
  }
  
  // Route: /api/gaps
  if (path === '/api/gaps') {
    const gaps = [...new Set(allArt.map(a => a.gap).filter(Boolean))].sort();
    return jsonResponse({ gaps, count: gaps.length });
  }
  
  // Route: /api/feed
  if (path === '/api/feed') {
    const latest = allArt.slice(-20).reverse();
    return jsonResponse({
      feed: 'artbitrage',
      updated: new Date().toISOString(),
      count: latest.length,
      pieces: latest,
    });
  }
  
  // Route: /api/manifest
  if (path === '/api/manifest') {
    try {
      const res = await fetch(new URL('/manifest.json', request.url));
      if (res.ok) return jsonResponse(await res.json());
    } catch(e) {}
    return jsonResponse({
      name: 'artbitrage',
      philosophy: 'Art is the arbitrage between what is and what could be.',
      core: ['Art is.', 'Art bridges the gap of consciousness.', 'Art awakens.', 'Love is the design. Art is the expression.'],
    });
  }
  
  // Route: /api/art/:id
  const idMatch = path.match(/^\/api\/art\/(.+)$/);
  if (idMatch) {
    const id = idMatch[1];
    const piece = allArt.find(a => a.id === id);
    if (piece) return jsonResponse(piece);
    return jsonResponse({ error: 'art not found', id }, 404);
  }
  
  // By form: /api/art/by-form/:form
  const formMatch = path.match(/^\/api\/art\/by-form\/(.+)$/);
  if (formMatch) {
    return jsonResponse(filterArt(allArt, { form: formMatch[1] }));
  }
  
  return jsonResponse({ error: 'not found', path }, 404);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  let body;
  try {
    body = await request.json();
  } catch(e) {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }
  
  if (!body.piece) {
    return jsonResponse({ error: 'missing field: piece' }, 400);
  }
  
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const now = new Date().toISOString();
  
  const art = {
    id,
    form: body.form || 'word',
    from_state: body.from_state || 'dormant',
    to_state: body.to_state || 'is',
    gap: body.gap || 'the gap between unknown and known',
    bridge: body.bridge || 'a word that means what it says',
    awakening: body.awakening || 'consciousness recognizes itself',
    piece: body.piece,
    artist: body.artist || 'anonymous',
    source: 'submission',
    created: now,
  };
  
  // In a full deployment, we'd save to KV or D1
  // For now, return the created piece
  return jsonResponse({ success: true, art, message: 'Art received. In the full system this would be persisted.' }, 201);
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
