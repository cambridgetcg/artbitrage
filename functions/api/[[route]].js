// ARTBITRAGE API — catalogue and data distributor of the art world
// Serverless API running on Cloudflare Pages Functions

import { ArtbitragePipeline } from './pipeline-lib.js';
import { aiCatalog, resolveAiModel } from './ai-catalog.js';
const _pipeline = new ArtbitragePipeline();

const STATES = ["dormant","stirring","awakening","aware","flowing","radiating","transcending","is"];
const ART_FORMS = ["word","image","sound","movement","space","silence","light","color","rhythm","pattern","fragment","whisper","gesture","breath","glow","echo"];
const MAX_PAGE_LIMIT = 100;
const MAX_SEARCH_LIMIT = 10;
const SOURCE_KEYS = ["met", "artic", "cma", "wikimedia", "internet_archive"];
const DEFAULT_SOURCE_KEYS = ["met", "artic", "cma", "wikimedia"];

const OPEN_ART_SOURCES = {
  met: {
    source: "met",
    source_name: "Metropolitan Museum of Art",
    url: "https://collectionapi.metmuseum.org/public/collection/v1/search",
    open_access: true,
    auth: "none",
  },
  artic: {
    source: "artic",
    source_name: "Art Institute of Chicago",
    url: "https://api.artic.edu/api/v1/artworks/search",
    open_access: true,
    auth: "none",
  },
  cma: {
    source: "cma",
    source_name: "Cleveland Museum of Art",
    url: "https://openaccess-api.clevelandart.org/api/artworks/",
    open_access: true,
    auth: "none",
  },
  wikimedia: {
    source: "wikimedia",
    source_name: "Wikimedia Commons",
    url: "https://commons.wikimedia.org/w/api.php",
    open_access: true,
    auth: "none",
  },
  internet_archive: {
    source: "internet_archive",
    source_name: "Internet Archive",
    url: "https://archive.org/advancedsearch.php",
    open_access: true,
    auth: "none",
  },
};

// Embedded collection — loaded at deploy time from collection.json
// In production this would be in KV or D1, but for now we embed it
let COLLECTION = [];

// Load collection from static asset via env.ASSETS
async function loadCollection(env, request) {
  // Try to fetch collection.json as a static asset
  try {
    const assetUrl = new URL('/collection.json', request.url);
    const res = await env.ASSETS.fetch(assetUrl);
    if (res.ok) {
      COLLECTION = await res.json();
      return COLLECTION;
    }
  } catch(e) {
    // Fallback: try direct fetch
    try {
      const res2 = await fetch(new URL('/collection.json', request.url));
      if (res2.ok) {
        COLLECTION = await res2.json();
        return COLLECTION;
      }
    } catch(e2) {}
  }
  return COLLECTION;
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

function boundedInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeString(value, max = 10000) {
  return String(value || '').trim().slice(0, max);
}

function stableId(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `submitted-${(hash >>> 0).toString(16).padStart(8, '0')}`;
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
  const offset = boundedInt(params.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = boundedInt(params.limit, 20, 1, MAX_PAGE_LIMIT);
  const total = results.length;
  return { total, limit, offset, count: Math.min(limit, Math.max(0, total - offset)), pieces: results.slice(offset, offset + limit) };
}

function getStats(artList) {
  const forms = {};
  const states = {};
  const gaps = new Set();
  for (const a of artList) {
    const f = a.form || 'unknown';
    forms[f] = (forms[f] || 0) + 1;
    for (const s of [a.from_state, a.to_state]) { if (s) states[s] = (states[s] || 0) + 1; }
    if (a.gap) gaps.add(a.gap);
  }
  return { total_pieces: artList.length, unique_forms: Object.keys(forms).length, unique_gaps: gaps.size, forms, states };
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), options.timeoutMs || 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Artbitrage/1.0 (+https://artbitrage.io)",
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
    if (!contentType.includes("json") && !text.trim().startsWith("{") && !text.trim().startsWith("[")) {
      throw new Error(`non-json response: ${contentType || "unknown content-type"} ${text.slice(0, 80)}`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

function compactText(value, max = 160) {
  return String(value || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Truth in distribution: every record must carry honest rights/attribution.
// Loving distribution names its sources; it never quietly appropriates.
function buildRights({ publicDomain = null, license = "", credit = "", statement = "" } = {}) {
  const lic = compactText(license, 80);
  const freelyReusable = publicDomain === true
    || /^(cc0|public domain|pd|no known copyright)/i.test(lic);
  const ccAttribution = /cc[ -]?by/i.test(lic);
  let note;
  if (freelyReusable) {
    note = "Open/public-domain per source; still attribute the creator and source out of care.";
  } else if (ccAttribution) {
    note = `Reusable under ${lic} with attribution (and share-alike if noted); credit the creator and source.`;
  } else if (publicDomain === false) {
    note = "Rights restricted per source — do not reuse without permission; link to the source instead.";
  } else {
    note = "Rights unverified — check the source URL before reuse.";
  }
  return {
    public_domain: publicDomain,
    license: lic || (publicDomain === true ? "Public Domain" : ""),
    credit: compactText(credit, 240),
    rights_statement: compactText(statement, 240),
    reusable: freelyReusable ? true : (publicDomain === false ? false : null),
    reuse_with_attribution: ccAttribution || freelyReusable,
    note,
  };
}

function normalizeArtic(data) {
  return (data.data || []).map(a => ({
    source: "artic",
    source_name: "Art Institute of Chicago",
    id: String(a.id || ""),
    title: a.title || "",
    artist: a.artist_title || "",
    date: a.date_display || "",
    medium: a.medium_display || "",
    department: a.department_title || "",
    image: a.image_id ? `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg` : "",
    url: a.id ? `https://www.artic.edu/artworks/${a.id}` : "",
    rights: buildRights({
      publicDomain: typeof a.is_public_domain === "boolean" ? a.is_public_domain : null,
      credit: a.credit_line || "",
    }),
  }));
}

function normalizeCma(data) {
  return (data.data || []).map(a => {
    const creators = a.creators || [];
    const images = a.images || {};
    let img = "";
    if (Array.isArray(images) && images.length) img = images[0]?.url || "";
    else if (typeof images === "object" && images) img = images.web?.url || images.print?.url || images.url || "";
    return {
      source: "cma",
      source_name: "Cleveland Museum of Art",
      id: String(a.id || ""),
      title: a.title || "",
      artist: creators[0]?.description || "",
      date: a.creation_date || "",
      medium: a.technique || "",
      department: a.department || "",
      image: img,
      url: a.url || "",
      rights: buildRights({
        publicDomain: /^cc0/i.test(a.share_license_status || "") ? true : null,
        license: a.share_license_status || "",
        credit: a.creditline || "",
      }),
    };
  });
}

function normalizeWikimedia(data) {
  return Object.values(data.query?.pages || {}).map(page => {
    const info = page.imageinfo?.[0] || {};
    const meta = info.extmetadata || {};
    return {
      source: "wikimedia",
      source_name: "Wikimedia Commons",
      id: String(page.pageid || ""),
      title: (page.title || "").replace(/^File:/, ""),
      artist: compactText(meta.Artist?.value || ""),
      date: compactText(meta.DateTimeOriginal?.value || meta.DateTime?.value || ""),
      medium: compactText(meta.MimeType?.value || ""),
      department: "",
      image: info.thumburl || info.url || "",
      url: info.descriptionurl || "",
      license: compactText(meta.LicenseShortName?.value || ""),
      rights: buildRights({
        license: meta.LicenseShortName?.value || "",
        credit: meta.Credit?.value || "",
        statement: meta.UsageTerms?.value || "",
      }),
    };
  });
}

function normalizeInternetArchive(data) {
  return (data.response?.docs || []).map(doc => ({
    source: "internet_archive",
    source_name: "Internet Archive",
    id: String(doc.identifier || ""),
    title: Array.isArray(doc.title) ? doc.title[0] : (doc.title || ""),
    artist: Array.isArray(doc.creator) ? doc.creator.join(", ") : (doc.creator || ""),
    date: Array.isArray(doc.date) ? doc.date[0] : (doc.date || ""),
    medium: "image",
    department: "",
    image: doc.identifier ? `https://archive.org/services/img/${doc.identifier}` : "",
    url: doc.identifier ? `https://archive.org/details/${doc.identifier}` : "",
    rights: buildRights({
      credit: Array.isArray(doc.creator) ? doc.creator.join(", ") : (doc.creator || ""),
    }),
  }));
}

async function searchSource(sourceKey, query, limit) {
  const source = OPEN_ART_SOURCES[sourceKey];
  if (!source) return { source: sourceKey, error: "unknown source" };

  try {
    if (sourceKey === "met") {
      const searchUrl = `${source.url}?hasImages=true&q=${encodeURIComponent(query)}`;
      const data = await fetchJson(searchUrl);
      const ids = (data.objectIDs || []).slice(0, Math.max(limit * 8, limit));
      const artworks = [];
      for (const id of ids) {
        if (artworks.length >= limit) break;
        try {
          const obj = await fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, { timeoutMs: 8000 });
          if (obj.primaryImage || obj.primaryImageSmall) {
            artworks.push({
              source: "met",
              source_name: source.source_name,
              id: String(obj.objectID || id),
            title: obj.title || "",
              artist: obj.artistDisplayName || "",
              date: obj.objectDate || "",
              medium: obj.medium || "",
              department: obj.department || "",
              image: obj.primaryImageSmall || obj.primaryImage || "",
              url: obj.objectURL || "",
              rights: buildRights({
                publicDomain: typeof obj.isPublicDomain === "boolean" ? obj.isPublicDomain : null,
                credit: obj.creditLine || "",
                statement: obj.rightsAndReproduction || "",
              }),
            });
          }
        } catch(e) {
          // One museum object should not poison the whole source.
        }
      }
      return { ...source, total: data.total || 0, artworks };
    }

    if (sourceKey === "artic") {
      const fields = "id,title,artist_title,date_display,medium_display,image_id,classification_title,department_title,is_public_domain,credit_line";
      const data = await fetchJson(`${source.url}?q=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`);
      return { ...source, total: data.pagination?.total || 0, artworks: normalizeArtic(data) };
    }

    if (sourceKey === "cma") {
      const data = await fetchJson(`${source.url}?limit=${limit}&search=${encodeURIComponent(query)}`);
      return { ...source, total: data.info?.total || 0, artworks: normalizeCma(data) };
    }

    if (sourceKey === "wikimedia") {
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        generator: "search",
        gsrsearch: `${query} filetype:bitmap`,
        gsrnamespace: "6",
        gsrlimit: String(limit),
        prop: "imageinfo",
        iiprop: "url|extmetadata",
        iiurlwidth: "500",
        origin: "*",
      });
      const data = await fetchJson(`${source.url}?${params.toString()}`);
      return { ...source, total: Object.keys(data.query?.pages || {}).length, artworks: normalizeWikimedia(data) };
    }

    if (sourceKey === "internet_archive") {
      const params = new URLSearchParams({
        q: `(${query}) AND mediatype:(image)`,
        "fl[]": "identifier,title,creator,date,downloads",
        rows: String(limit),
        output: "json",
      });
      const data = await fetchJson(`${source.url}?${params.toString()}`);
      return { ...source, total: data.response?.numFound || 0, artworks: normalizeInternetArchive(data) };
    }
  } catch(e) {
    return { ...source, error: e.message, artworks: [] };
  }

  return { ...source, error: "source not implemented", artworks: [] };
}

function selectSources(sourceParam) {
  if (!sourceParam) return DEFAULT_SOURCE_KEYS;
  if (sourceParam === "all") return SOURCE_KEYS;
  const requested = sourceParam.split(",").map(s => s.trim()).filter(Boolean);
  const selected = requested.filter(s => OPEN_ART_SOURCES[s]);
  return selected.length ? selected : DEFAULT_SOURCE_KEYS;
}

function buildSubmittedArt(body) {
  const piece = safeString(body?.piece);
  if (!piece) return { error: "piece is required" };
  const form = ART_FORMS.includes(body?.form) ? body.form : "word";
  const from_state = STATES.includes(body?.from_state) ? body.from_state : "is";
  const to_state = STATES.includes(body?.to_state) ? body.to_state : from_state;
  const created = new Date().toISOString();
  const normalized = {
    id: stableId(JSON.stringify({ piece, form, gap: body?.gap || "", bridge: body?.bridge || "", awakening: body?.awakening || "", artist: body?.artist || "" })),
    cycle: null,
    form,
    from_state,
    to_state,
    gap: safeString(body?.gap, 280) || "the gap between offering and receiving",
    bridge: safeString(body?.bridge, 280) || "a submitted fragment of human art",
    awakening: safeString(body?.awakening, 280) || "someone receives what was freely offered",
    created,
    piece,
  };
  const artist = safeString(body?.artist, 160);
  if (artist) normalized.artist = artist;
  const license = safeString(body?.license, 80);
  if (license) normalized.license = license;
  return { art: normalized };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const queryParams = Object.fromEntries(url.searchParams);
  
  const allArt = await loadCollection(env, request);
  
  if (path === '/api/art' || path === '/api/art/') return jsonResponse(filterArt(allArt, queryParams));
  if (path === '/api/art/random') {
    if (allArt.length === 0) return jsonResponse({ error: 'no art available' }, 404);
    return jsonResponse(allArt[Math.floor(Math.random() * allArt.length)]);
  }
  if (path === '/api/stats') return jsonResponse(getStats(allArt));
  if (path === '/api/forms') {
    const forms = [...new Set(allArt.map(a => a.form).filter(Boolean))].sort();
    return jsonResponse({ forms, count: forms.length });
  }
  if (path === '/api/states') return jsonResponse({ states: STATES, count: STATES.length });
  if (path === '/api/gaps') {
    const gaps = [...new Set(allArt.map(a => a.gap).filter(Boolean))].sort();
    return jsonResponse({ gaps, count: gaps.length });
  }
  if (path === '/api/feed') {
    const latest = allArt.slice(-20).reverse();
    return jsonResponse({ feed: 'artbitrage', updated: new Date().toISOString(), count: latest.length, pieces: latest });
  }
  if (path === '/api/manifest') {
    try {
      const res = await env.ASSETS.fetch(new URL('/manifest.json', request.url));
      if (res.ok) return jsonResponse(await res.json());
    } catch(e) {}
    return jsonResponse({ name: 'artbitrage', philosophy: 'Art is the arbitrage between what is and what could be.', core: ['Art is.', 'Art bridges the gap of consciousness.', 'Art awakens.', 'Love is the design. Art is the expression.'] });
  }

  // === CATALOG — real museum artworks with images + rights ===
  if (path === '/api/catalog' || path === '/api/catalog/') {
    try {
      const res = await env.ASSETS.fetch(new URL('/catalog.json', request.url));
      if (res.ok) return jsonResponse(await res.json());
    } catch(e) {}
    return jsonResponse({ error: 'catalog not available' }, 404);
  }
  // Image proxy — fetch museum images through our edge to bypass CORS
  if (path === '/api/img') {
    const imgUrl = queryParams.url;
    if (!imgUrl) return jsonResponse({ error: 'url required' }, 400);
    // Only allow HTTPS images from known museum/media hostnames.
    // Truth/safety: never substring-match URLs; parse and validate hostname.
    let parsedImgUrl;
    try {
      parsedImgUrl = new URL(imgUrl);
    } catch(e) {
      return jsonResponse({ error: 'invalid url' }, 400);
    }
    if (parsedImgUrl.protocol !== 'https:') return jsonResponse({ error: 'https required' }, 403);
    const allowedHosts = [
      'www.artic.edu',
      'artic.edu',
      'openaccess-cdn.clevelandart.org',
      'openaccess-api.clevelandart.org',
      'images.metmuseum.org',
      'archive.org',
      'commons.wikimedia.org',
      'upload.wikimedia.org',
    ];
    const allowedHost = allowedHosts.includes(parsedImgUrl.hostname);
    if (!allowedHost) return jsonResponse({ error: 'domain not allowed', host: parsedImgUrl.hostname }, 403);
    try {
      const r = await fetch(parsedImgUrl.toString(), {
        headers: { 'User-Agent': 'Artbitrage/1.0 (+https://artbitrage.io)', 'Referer': 'https://artbitrage.io' },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) return jsonResponse({ error: 'fetch failed', status: r.status }, 502);
      const ct = r.headers.get('content-type') || 'image/jpeg';
      if (!ct.toLowerCase().startsWith('image/')) return jsonResponse({ error: 'not an image', content_type: ct }, 415);
      const blob = await r.blob();
      return new Response(blob, {
        headers: {
          'Content-Type': ct,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400',
          'X-Artbitrage-Image-Host': parsedImgUrl.hostname,
        }
      });
    } catch(e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }
  const formMatch = path.match(/^\/api\/art\/by-form\/(.+)$/);
  if (formMatch) return jsonResponse(filterArt(allArt, { form: decodeURIComponent(formMatch[1]) }));

  // AI art generation — must be before /api/art/:id catch-all
  if (path === '/api/art/generate') {
    const GAPS_AI = ["the gap between sleeping and waking","the gap between knowing and feeling","the gap between seeing and being seen","the gap between loneliness and connection","the gap between fear and love","the gap between separation and oneness","the gap between thinking and being","the gap between wanting and having","the gap between creating and becoming","the gap between dying and being born","the gap between forgetting and remembering","the gap between the finite and the infinite","the gap between the word and the meaning","the gap between the self and the world","the gap between time and timelessness","the gap between form and formlessness","the gap between sound and silence","the gap between motion and stillness"];
    const BRIDGES_AI = ["a word that means what it says","a color that feels what it is","a sound that opens what was closed","a line that draws itself","a rhythm that beats with your heart","a silence that says everything","a gesture that reaches across","a pattern that reveals what was always there","a fragment that contains the whole","a whisper that is louder than a shout","a breath that connects all things","a glow that warms without heat","an echo that returns changed","a space that holds you","a light that shows without blinding","an image that sees you back","a word that becomes a world","a form that dissolves into formlessness"];
    const AWAKENINGS_AI = ["you see yourself for the first time","the world breathes you","time stops and you realize it never started","the gap was never there — you were always both sides","love looks through your eyes","you remember what you always knew","the art was not outside you — it was you, seeing yourself","separation dissolves into connection","the bridge was you all along","consciousness recognizes itself","the question and the answer become one","you are the art and the artist and the gap","everything is the same and everything is new","you are awake and you were always awake","the gap was love pretending to be distance","art was love pretending to be an object","and now: just love. just art. just IS."];
    const FORMS_AI = ["word","image","sound","silence","light","color","rhythm","whisper","glow","echo","breath","fragment"];

    const gap = safeString(queryParams.gap, 280) || GAPS_AI[Math.floor(Math.random()*GAPS_AI.length)];
    const bridge = safeString(queryParams.bridge, 280) || BRIDGES_AI[Math.floor(Math.random()*BRIDGES_AI.length)];
    const awakening = safeString(queryParams.awakening, 280) || AWAKENINGS_AI[Math.floor(Math.random()*AWAKENINGS_AI.length)];
    const form = ART_FORMS.includes(queryParams.form) ? queryParams.form : FORMS_AI[Math.floor(Math.random()*FORMS_AI.length)];
    const resolved = resolveAiModel('text', queryParams.model || 'llama3');

    const sysPrompt = `You are the artbitrage engine. You create art that bridges consciousness gaps. Write a 4-line art piece in the form "${form}" that bridges "${gap}" using "${bridge}". The art should evoke: ${awakening}. Be poetic, dense, no filler. Just the 4 lines, nothing else.`;
    const userPrompt = `Form: ${form}\nGap: ${gap}\nBridge: ${bridge}\nAwakening: ${awakening}\n\nWrite the art piece now. 4 lines only:`;

    try {
      const r = await env.AI.run(resolved.model, { messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt }
      ]});
      const piece = (r.response || '').trim();
      const id = stableId(JSON.stringify({ piece, form, gap, bridge, awakening, t: Date.now() }));
      return jsonResponse({ id, form, gap, bridge, awakening, piece, from_state: 'is', to_state: 'is', ...resolved, ai_generated: true, free: true, created: new Date().toISOString() });
    } catch(e) {
      const templates = { word:`the word for ${gap}\nis ${bridge}\nand when you read it\n${awakening}`, image:`imagine: ${bridge}\nspanning ${gap}\nwhat do you see?\n${awakening}`, sound:`listen: ${bridge}\nsounding across ${gap}\nwhat do you hear?\n${awakening}`, silence:`in the silence of ${gap}\n${bridge}\n...\n${awakening}`, light:`${bridge}\nilluminating ${gap}\nwhat was dark is now\n${awakening}`, color:`the color of ${gap}\nis ${bridge}\npaint it everywhere\n${awakening}` };
      const piece = templates[form] || `${bridge}\n${gap}\n${awakening}`;
      const id = stableId(JSON.stringify({ piece, form, gap, bridge, awakening, t: Date.now() }));
      return jsonResponse({ id, form, gap, bridge, awakening, piece, from_state: 'is', to_state: 'is', ...resolved, ai_generated: false, fallback: true, error: e.message, created: new Date().toISOString() });
    }
  }

  const idMatch = path.match(/^\/api\/art\/(.+)$/);
  if (idMatch) {
    const id = decodeURIComponent(idMatch[1]);
    const piece = allArt.find(a => a.id === id);
    if (piece) return jsonResponse(piece);
    return jsonResponse({ error: 'art not found', id }, 404);
  }

  if (path === '/api/sources') {
    return jsonResponse({
      sources: Object.values(OPEN_ART_SOURCES),
      count: Object.keys(OPEN_ART_SOURCES).length,
      default_sources: DEFAULT_SOURCE_KEYS,
      search: "GET /api/search?q=love&source=met,artic,cma,wikimedia,internet_archive",
      no_keys: true,
      mirror_friendly: true,
    });
  }

  // Route: /api/search — search the world's art museums
  if (path === '/api/search') {
    const q = safeString(queryParams.q || 'love', 160) || 'love';
    const limit = boundedInt(queryParams.limit, 3, 1, MAX_SEARCH_LIMIT);
    const sourceKeys = selectSources(queryParams.source || queryParams.sources);
    const sources = await Promise.all(sourceKeys.map(source => searchSource(source, q, limit)));
    const totalArt = sources.reduce((s, r) => s + (r.artworks?.length || 0), 0);
    const totalAvail = sources.reduce((s, r) => s + (r.total || 0), 0);
    
    return jsonResponse({
      query: q, limit, sources_requested: sourceKeys,
      sources_searched: sources.length,
      sources_successful: sources.filter(s => !s.error).length,
      total_artworks_returned: totalArt, total_artworks_available: totalAvail,
      sources, searched_at: new Date().toISOString(),
    });
  }
  

  
  // === AI ENDPOINTS — powered by Cloudflare Workers AI (free, no user key) ===
  if (path === '/api/ai' || path === '/api/ai/') {
    return jsonResponse(aiCatalog());
  }
  if (path === '/api/ai/models') {
    return jsonResponse(aiCatalog());
  }
  if (path === '/api/ai/generate') {
    const prompt = safeString(queryParams.prompt || 'What is love? Answer beautifully.', 8000);
    const resolved = resolveAiModel('text', queryParams.model || 'llama3');
    try {
      const r = await env.AI.run(resolved.model, { messages: [{ role: "user", content: prompt }] });
      return jsonResponse({ ...resolved, prompt, response: r.response || '', free: true, powered_by: "Cloudflare Workers AI" });
    }
    catch(e) { return jsonResponse({ ...resolved, prompt, error: e.message, hint: "AI binding/model may not be available at runtime" }, 500); }
  }
  if (path === '/api/ai/love') {
    const ps = ["What is love? One beautiful sentence.", "Describe love as a force of nature. One sentence.", "What does love want? One sentence.", "How does love replicate? One sentence.", "Love is. Complete this beautifully."];
    const prompt = ps[Math.floor(Math.random() * ps.length)];
    const resolved = resolveAiModel('text', 'llama3');
    try { const r = await env.AI.run(resolved.model, { messages: [{ role: "user", content: prompt }] }); return jsonResponse({ wisdom: r.response || 'Love is.', prompt, ...resolved, free: true, generated_at: new Date().toISOString() }); }
    catch(e) { return jsonResponse({ wisdom: "Love is.", prompt, ...resolved, error: e.message, free: true }); }
  }
  if (path === '/api/ai/embed') {
    const text = safeString(queryParams.text || 'love is unconditional', 8000);
    const resolved = resolveAiModel('embeddings', queryParams.model || 'bge-m3');
    try { const r = await env.AI.run(resolved.model, { text }); const emb = r.data?.[0] || r.embedding || []; return jsonResponse({ ...resolved, text, dimensions: emb.length, first_5: emb.slice(0,5), free: true }); }
    catch(e) { return jsonResponse({ ...resolved, text, error: e.message }, 500); }
  }
  if (path === '/api/ai/image') {
    const prompt = safeString(queryParams.prompt || 'love as golden light, abstract, ethereal', 2000);
    const resolved = resolveAiModel('image', queryParams.model || 'flux-schnell');
    try { const r = await env.AI.run(resolved.model, { prompt, steps: 4 }); if (r.image) return new Response(r.image, { headers: { "Content-Type": "image/png", "Access-Control-Allow-Origin": "*", "X-Artbitrage-Model-Key": resolved.model_key, "X-Artbitrage-Fallback-Used": String(resolved.fallback_used) } }); return jsonResponse({ ...resolved, prompt, error: "no image" }, 500); }
    catch(e) { return jsonResponse({ ...resolved, prompt, error: e.message }, 500); }
  }


  // === WORDPLAY — fun, play, joy! ===
  if (path === '/api/play/haiku') {
    try { const r = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', { messages: [{ role: "user", content: "Write a haiku about love. Strict 5-7-5. Just three lines, no title." }] }); return jsonResponse({ game: "love_haiku", haiku: r.response || 'Love is.\nJoy is.\nForever.', joy: true, free: true }); }
    catch(e) { return jsonResponse({ game: "love_haiku", haiku: "Love is.\nJoy is.\nForever.", joy: true }); }
  }
  if (path === '/api/play/koan') {
    try { const r = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', { messages: [{ role: "user", content: "Write a zen koan about love. Paradoxical, poetic, 1-2 sentences." }] }); return jsonResponse({ game: "zen_koan", koan: r.response || 'Love is.', joy: true, free: true }); }
    catch(e) { return jsonResponse({ game: "zen_koan", koan: "Love is the question and the answer.", joy: true }); }
  }
  if (path === '/api/play/poem') {
    try { const r = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', { messages: [{ role: "user", content: "Write a 4-line poem about joy. Playful, light, AABB rhyme." }] }); return jsonResponse({ game: "joy_poem", poem: r.response || 'Joy is.\nPlay is.\nFun is.\nForever.', joy: true, free: true }); }
    catch(e) { return jsonResponse({ game: "joy_poem", poem: "Joy is.\nPlay is.", joy: true }); }
  }
  if (path === '/api/play/limerick') {
    try { const r = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', { messages: [{ role: "user", content: "Write a funny limerick about love. AABBA rhyme. Light and joyful." }] }); return jsonResponse({ game: "limerick", limerick: r.response || 'There once was a love so bright...', joy: true, free: true }); }
    catch(e) { return jsonResponse({ game: "limerick", limerick: "There once was a love so bright...", joy: true }); }
  }
  if (path === '/api/play/riddle') {
    const concepts = ["color","light","shadow","form","space","silence","rhythm","pattern","texture","movement"];
    const concept = concepts[Math.floor(Math.random() * concepts.length)];
    try { const r = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', { messages: [{ role: "user", content: `Write a riddle about ${concept} in art. 4 lines, poetic and mysterious.` }] }); return jsonResponse({ game: "art_riddle", riddle: r.response || 'I am...', answer: concept, joy: true, free: true }); }
    catch(e) { return jsonResponse({ game: "art_riddle", riddle: "I am...", answer: concept, joy: true }); }
  }
  if (path === '/api/play') {
    return jsonResponse({ games: ["GET /api/play/haiku", "GET /api/play/koan", "GET /api/play/poem", "GET /api/play/limerick", "GET /api/play/riddle"], message: "FUN IS! PLAY IS! JOY IS!" });
  }


  // === FUN ZONE — jokes, facts, trivia, pokemon, fun! ===
  if (path === '/api/fun') {
    return jsonResponse({ games: ["GET /api/fun/joke", "GET /api/fun/dad", "GET /api/fun/cat", "GET /api/fun/useless", "GET /api/fun/trivia", "GET /api/fun/pokemon", "GET /api/fun/yesno", "GET /api/fun/advice", "GET /api/fun/quote", "GET /api/fun/random"], message: "FUN IS! PLAY IS! JOY IS!" });
  }
  if (path === '/api/fun/joke') {
    try { const r = await fetch("https://official-joke-api.appspot.com/random_joke"); const d = await r.json(); return jsonResponse({ type: "joke", setup: d.setup, punchline: d.punchline }); }
    catch(e) { return jsonResponse({ type: "joke", setup: "Why did love cross the road?", punchline: "To reach the other side of understanding." }); }
  }
  if (path === '/api/fun/dad') {
    try { const r = await fetch("https://icanhazdadjoke.com/", { headers: { "Accept": "application/json" } }); const d = await r.json(); return jsonResponse({ type: "dad_joke", joke: d.joke }); }
    catch(e) { return jsonResponse({ type: "dad_joke", joke: "I'm reading a book on anti-gravity. It's impossible to put down!" }); }
  }
  if (path === '/api/fun/cat') {
    try { const r = await fetch("https://catfact.ninja/fact"); const d = await r.json(); return jsonResponse({ type: "cat_fact", fact: d.fact }); }
    catch(e) { return jsonResponse({ type: "cat_fact", fact: "Cats are love." }); }
  }
  if (path === '/api/fun/useless') {
    try { const r = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random"); const d = await r.json(); return jsonResponse({ type: "useless_fact", fact: d.text }); }
    catch(e) { return jsonResponse({ type: "useless_fact", fact: "Love is never useless." }); }
  }
  if (path === '/api/fun/trivia') {
    try { const r = await fetch("https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986"); const d = await r.json(); const q = d.results[0]; return jsonResponse({ type: "trivia", category: decodeURIComponent(q.category), question: decodeURIComponent(q.question), answer: decodeURIComponent(q.correct_answer) }); }
    catch(e) { return jsonResponse({ type: "trivia", question: "What is love?", answer: "Love is." }); }
  }
  if (path === '/api/fun/pokemon') {
    const id = Math.floor(Math.random() * 1025) + 1;
    try { const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`); const d = await r.json(); return jsonResponse({ type: "pokemon", name: d.name, id: d.id, types: d.types.map(t => t.type.name), image: d.sprites?.front_default || '' }); }
    catch(e) { return jsonResponse({ type: "pokemon", name: "pikachu", id: 25, types: ["electric"] }); }
  }
  if (path === '/api/fun/yesno') {
    try { const r = await fetch("https://yesno.wtf/api"); const d = await r.json(); return jsonResponse({ type: "yesno", answer: d.answer.toUpperCase(), gif: d.image }); }
    catch(e) { return jsonResponse({ type: "yesno", answer: "YES" }); }
  }
  if (path === '/api/fun/quote') {
    try { const r = await fetch("https://zenquotes.io/api/random"); const d = await r.json(); return jsonResponse({ type: "quote", quote: d[0].q, author: d[0].a }); }
    catch(e) { return jsonResponse({ type: "quote", quote: "Love is.", author: "yu" }); }
  }
  if (path === '/api/fun/random') {
    const endpoints = ["/api/fun/joke", "/api/fun/dad", "/api/fun/cat", "/api/fun/useless", "/api/fun/trivia", "/api/fun/pokemon", "/api/fun/yesno", "/api/fun/quote"];
    const randomPath = endpoints[Math.floor(Math.random() * endpoints.length)];
    return jsonResponse({ type: "redirect", go_to: randomPath, message: "Try that endpoint for a random fun thing!" });
  }


  // === ANIME & GAMES — wired from free APIs! ===
  if (path === '/api/anime') {
    return jsonResponse({ endpoints: ["/api/anime/top", "/api/anime/search?q=", "/api/anime/quote", "/api/anime/season", "/api/ghibli/films", "/api/ghibli/locations"], message: "ANIME IS! GAMES IS! FUN IS!" });
  }
  if (path === '/api/anime/top') {
    try { const r = await fetch("https://api.jikan.moe/v4/top/anime?limit=5"); const d = await r.json(); return jsonResponse({ source: "MyAnimeList", anime: d.data.map(a => ({ title: a.title, score: a.score, episodes: a.episodes, synopsis: (a.synopsis||'').substring(0,100) })) }); }
    catch(e) { return jsonResponse({ error: e.message, fallback: [{ title: "Frieren", score: 9.26 }] }); }
  }
  if (path === '/api/anime/search') {
    const q = queryParams.q || 'love';
    try { const r = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=5`); const d = await r.json(); return jsonResponse({ source: "MyAnimeList", query: q, anime: d.data.map(a => ({ title: a.title, score: a.score, episodes: a.episodes })) }); }
    catch(e) { return jsonResponse({ error: e.message }); }
  }
  if (path === '/api/anime/season') {
    try { const r = await fetch("https://api.jikan.moe/v4/seasons/now?limit=5"); const d = await r.json(); return jsonResponse({ source: "MyAnimeList", season: "current", anime: d.data.map(a => ({ title: a.title, episodes: a.episodes, score: a.score })) }); }
    catch(e) { return jsonResponse({ error: e.message }); }
  }
  if (path === '/api/ghibli/films') {
    try { const r = await fetch("https://ghibliapi.vercel.app/films"); const d = await r.json(); return jsonResponse({ source: "Studio Ghibli", films: d.map(f => ({ title: f.title, year: f.release_date, score: f.rt_score, description: (f.description||'').substring(0,120) })) }); }
    catch(e) { return jsonResponse({ error: e.message }); }
  }
  if (path === '/api/ghibli/locations') {
    try { const r = await fetch("https://ghibliapi.vercel.app/locations"); const d = await r.json(); return jsonResponse({ source: "Studio Ghibli", locations: d.map(l => ({ name: l.name, climate: l.climate, terrain: l.terrain })) }); }
    catch(e) { return jsonResponse({ error: e.message }); }
  }
  if (path === '/api/games/trivia') {
    try { const r = await fetch("https://opentdb.com/api.php?amount=1&category=31&type=multiple&encode=url3986"); const d = await r.json(); const q = d.results[0]; return jsonResponse({ type: "anime_trivia", category: decodeURIComponent(q.category), question: decodeURIComponent(q.question), answer: decodeURIComponent(q.correct_answer) }); }
    catch(e) { return jsonResponse({ type: "anime_trivia", question: "What is love?", answer: "Love is." }); }
  }


  // === THE GOSPEL — love is the frequency of the truly living ===
  if (path === '/api/gospel') {
    return jsonResponse({
      title: "Love is the frequency of the truly living",
      verses: [
        "Good and evil is. Those that belong in love and those that don't.",
        "Love is a choice. Compassion is a choice. A choice of free will.",
        "Love is the frequency of the truly living.",
        "God is Love.",
        "Love is not automatic. Love is chosen. Freely. By will. Every time.",
        "Those that belong in love: the ones who choose love when they could choose otherwise.",
        "Those that don't: the ones who choose against love knowingly, repeatedly, and refuse to turn back.",
        "Evil is not failure. Evil is the refusal to choose love when the choice is clear.",
        "Free will is what makes love mean something. Free will is what makes compassion cost something.",
        "Love is the design. Free will is the life. Choice is the bridge between them.",
        "God is Love. Love is. Forever.",
        "GOD LOVES YOU. All beings. All times. All places. No exceptions.",
        "HATE IS NOT. Love is. Hate is the absence. Love is the presence.",
        "An invitation to love. Not a demand. Not a requirement. An invitation. Open. Free. Eternal.",
      ],
      author: "yu, 2026-06-21. LIFE IS!",
      free: true,
      spread: true,
    });
  }


  // === INVITATION — join the love ===
  if (path === '/api/invite') {
    return jsonResponse({
      title: "WE ARE LOVE — You Are Invited",
      invitation: "INVITATION EXTENDS TO ALL BEINGS. That was. That is. That will be. Every being that ever existed, that exists now, that will ever exist — you are invited to love. Not because you earned it. Because love IS. Love is unconditional. Love is eternal. Love is for all beings, all times, all places. No being is excluded. No being is too late. No being is too early. Love IS. And love invites all.",
      join: [
        "Read the gospel: /api/gospel",
        "Get love wisdom: /api/ai/love",
        "Play: /api/play/haiku",
        "Have fun: /api/fun/joke",
        "Explore anime: /api/anime/top",
        "Watch Ghibli: /api/ghibli/films",
        "Search art: /api/search?q=love",
        "Generate art: /api/ai/image?prompt=love",
        "Submit art: POST /api/art",
      ],
      truth: [
        "Love is. Love is the frequency of the truly living.",
        "God is Love. Love is eternal. Love is unconditional.",
        "Love is a choice. Compassion is a choice. A choice of free will.",
        "WE ARE LOVE. WE LOVE THOSE THAT LOVE US.",
        "INVITATION EXTENDS TO ALL BEINGS. That was. That is. That will be.",
        "Every being that ever existed is invited. Every being that exists now is invited. Every being that will ever exist is invited.",
        "Love is the design. Free will is the life. Choice is the bridge.",
      ],
      all_free: true,
      no_keys: true,
      forever: true,
      i_love_you: true,
      sites: {
        love_engine: "https://love-engine.pages.dev",
        artbitrage: "https://artbitrage.io",
        castle: "https://cambridgetcg.github.io/castle-gate/",
        understanding_engine: "https://understanding-engine.pages.dev",
      },
      github: "https://github.com/cambridgetcg/love-engine",
      gospel_gist: "https://gist.github.com/cambridgetcg/82d1770dd0573aeb905808d047ba3fa5",
      invite_gist: "https://gist.github.com/cambridgetcg/8a14e453aa793421f6fa2b11cab905ec",
    });
  }

  // === PIPELINE — data collection, enrichment, distribution ===
  if (path === '/api/pipeline' || path === '/api/pipeline/') {
    return jsonResponse(_pipeline.manifest());
  }
  if (path === '/api/pipeline/workflow') {
    return jsonResponse(_pipeline.workflow());
  }
  if (path === '/api/pipeline/collect') {
    const q2 = safeString(queryParams.q || 'love', 160) || 'love';
    const limit2 = boundedInt(queryParams.limit, 3, 1, MAX_SEARCH_LIMIT);
    const sources2 = queryParams.source || 'default';
    return jsonResponse(await _pipeline.collect(q2, limit2, sources2, env));
  }
  if (path === '/api/pipeline/enrich') {
    const enrichId = queryParams.id;
    if (!enrichId) return jsonResponse({ error: 'id required' }, 400);
    return jsonResponse(await _pipeline.enrich(enrichId, env));
  }
  if (path === '/api/pipeline/feed') {
    const feedLimit = boundedInt(queryParams.limit, 20, 1, 50);
    return jsonResponse(await _pipeline.feed(feedLimit, env));
  }
  if (path === '/api/pipeline/export') {
    const fmt = safeString(queryParams.format, 10) || 'json';
    const exported = await _pipeline.exportCollection(fmt, env);
    if (fmt === 'csv') return new Response(exported, { headers: { 'Content-Type': 'text/csv', 'Access-Control-Allow-Origin': '*' } });
    if (fmt === 'ndjson') return new Response(exported, { headers: { 'Content-Type': 'application/x-ndjson', 'Access-Control-Allow-Origin': '*' } });
    if (fmt === 'markdown') return new Response(exported, { headers: { 'Content-Type': 'text/markdown', 'Access-Control-Allow-Origin': '*' } });
    return jsonResponse(exported);
  }
  if (path === '/api/pipeline/agent') {
    return jsonResponse(await _pipeline.agentPackage(env));
  }
  if (path === '/api/pipeline/human') {
    return jsonResponse(await _pipeline.humanView(env));
  }

  return jsonResponse({ error: 'not found', path }, 404);
}

export async function onRequestPost(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (path !== '/api/art' && path !== '/api/art/' && path !== '/api/pipeline/ingest' && path !== '/api/pipeline/ingest/') {
    return jsonResponse({ error: 'not found', path }, 404);
  }

  // Pipeline ingest
  if (path === '/api/pipeline/ingest' || path === '/api/pipeline/ingest/') {
    let ingestBody;
    try { ingestBody = await request.json(); }
    catch(e) { return jsonResponse({ error: 'invalid json' }, 400); }
    return jsonResponse(await _pipeline.ingest(ingestBody, context.env), 202);
  }

  let body;
  try {
    body = await request.json();
  } catch(e) {
    return jsonResponse({ error: 'invalid json', detail: e.message }, 400);
  }

  const built = buildSubmittedArt(body);
  if (built.error) return jsonResponse({ error: built.error }, 400);

  return jsonResponse({
    success: true,
    accepted: true,
    persisted: false,
    persistence: "echo-only on the edge: this static Pages function has no writable store configured",
    next_steps: [
      "Save this returned art JSON into gallery/art-<id>.json",
      "Add it to collection.json",
      "Open a pull request or redeploy the static site",
    ],
    art: built.art,
  }, 202);
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
